package xyz.learnwithhasan.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private lateinit var errorView: LinearLayout
    private lateinit var root: FrameLayout

    /** https first; switches to http once if the server has no HTTPS. */
    private var scheme = "https"
    private val home get() = "$scheme://${BuildConfig.SITE_HOST}/"

    private var firstPageShown = false
    private var mainFrameFailed = false
    private var failedUrl: String? = null
    private var lastBackPress = 0L

    // File uploads (<input type="file">)
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        val uris: Array<Uri>? = if (result.resultCode != RESULT_OK || data == null) null else {
            val clip = data.clipData
            if (clip != null && clip.itemCount > 0) Array(clip.itemCount) { clip.getItemAt(it).uri }
            else data.data?.let { arrayOf(it) }
        }
        fileCallback?.onReceiveValue(uris)
        fileCallback = null
    }

    // Full-screen video / H5P
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        val started = SystemClock.elapsedRealtime()
        splash.setKeepOnScreenCondition {
            !firstPageShown && !mainFrameFailed && SystemClock.elapsedRealtime() - started < 3000
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)
        root = findViewById(R.id.root)
        web = findViewById(R.id.web)
        progress = findViewById(R.id.progress)
        errorView = findViewById(R.id.error)
        findViewById<Button>(R.id.retry).setOnClickListener { retry() }

        // Keep content clear of the status bar, navigation bar and keyboard
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            if (customView == null) {
                v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            }
            insets
        }

        setUpWebView()
        onBackPressedDispatcher.addCallback(this, backHandler)

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState)
        } else {
            web.loadUrl(siteUrlFrom(intent) ?: home)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true          // sign-in is kept in localStorage
            @Suppress("DEPRECATION")
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = true
            displayZoomControls = false
            setSupportZoom(true)
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)  // target=_blank opens in the same view
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            // Lets the website know it's inside the app
            userAgentString = "$userAgentString LearnwithHasanApp/${BuildConfig.VERSION_NAME}"
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (isOurSite(uri)) false else { openOutside(uri); true }
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                mainFrameFailed = false
                progress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String) {
                progress.visibility = View.GONE
                if (!mainFrameFailed) {
                    firstPageShown = true
                    errorView.visibility = View.GONE
                    web.visibility = View.VISIBLE
                }
                CookieManager.getInstance().flush()
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                applyScreenshotRule(url)
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                val url = request.url.toString()
                // No HTTPS on the server yet: fall back to http once
                val noHttps = error.errorCode == WebViewClient.ERROR_CONNECT ||
                    error.errorCode == WebViewClient.ERROR_FAILED_SSL_HANDSHAKE
                if (scheme == "https" && noHttps && isOnline() && isOurSite(request.url) && url.startsWith("https://")) {
                    scheme = "http"
                    view.loadUrl(url.replaceFirst("https://", "http://"))
                    return
                }
                showError(url)
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                if (newProgress >= 100) progress.visibility = View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: WebChromeClient.FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    val pick = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        mimeTypesFor(params.acceptTypes)?.let { putExtra(Intent.EXTRA_MIME_TYPES, it) }
                        if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    pickFiles.launch(Intent.createChooser(pick, null))
                    true
                } catch (e: ActivityNotFoundException) {
                    fileCallback = null
                    false
                }
            }

            override fun onShowCustomView(view: View, callback: WebChromeClient.CustomViewCallback) {
                if (customView != null) { callback.onCustomViewHidden(); return }
                customView = view
                customViewCallback = callback
                root.setPadding(0, 0, 0, 0)
                (window.decorView as ViewGroup).addView(
                    view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                )
                WindowInsetsControllerCompat(window, window.decorView).apply {
                    hide(WindowInsetsCompat.Type.systemBars())
                    systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }

            override fun onHideCustomView() = exitFullscreen()
        }

        web.setDownloadListener { url, _, _, _, _ -> openOutside(Uri.parse(url)) }
    }

    /**
     * The site's accept="…" list as MIME types for the file picker. Returns
     * null (show every file) when any entry has no known MIME type, e.g.
     * ".h5p", so those files are never hidden from the picker.
     */
    private fun mimeTypesFor(accept: Array<String>?): Array<String>? {
        val entries = accept.orEmpty().flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
        if (entries.isEmpty()) return null
        val types = mutableSetOf<String>()
        for (e in entries) {
            val t = if (e.contains('/')) e else MimeTypeMap.getSingleton().getMimeTypeFromExtension(e.removePrefix(".")) ?: return null
            types += t
        }
        return types.toTypedArray()
    }

    private fun exitFullscreen() {
        val view = customView ?: return
        (window.decorView as ViewGroup).removeView(view)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        ViewCompat.requestApplyInsets(root)
    }

    private val backHandler = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            when {
                customView != null -> exitFullscreen()
                errorView.visibility == View.VISIBLE && web.canGoBack() -> { errorView.visibility = View.GONE; web.goBack() }
                web.canGoBack() -> web.goBack()
                SystemClock.elapsedRealtime() - lastBackPress < 2000 -> finish()
                else -> {
                    lastBackPress = SystemClock.elapsedRealtime()
                    Toast.makeText(this@MainActivity, R.string.press_back_again, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ── Links ─────────────────────────────────────────────────────────

    private fun isOurSite(uri: Uri): Boolean {
        val host = uri.host?.lowercase() ?: return false
        return (uri.scheme == "https" || uri.scheme == "http") &&
            (host == BuildConfig.SITE_HOST || host.endsWith("." + BuildConfig.SITE_HOST))
    }

    /** Phone numbers, WhatsApp, bKash, YouTube, other websites → the right app. */
    private fun openOutside(uri: Uri) {
        val intent = if (uri.scheme == "intent") {
            try { Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).apply { selector = null; component = null } }
            catch (e: Exception) { return }
        } else {
            Intent(Intent.ACTION_VIEW, uri)
        }
        intent.addCategory(Intent.CATEGORY_BROWSABLE)
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            val fallback = intent.getStringExtra("browser_fallback_url")
            if (fallback != null) openOutside(Uri.parse(fallback))
            else Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    private fun siteUrlFrom(intent: Intent?): String? =
        intent?.data?.takeIf { intent.action == Intent.ACTION_VIEW && isOurSite(it) }?.toString()

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        siteUrlFrom(intent)?.let { web.loadUrl(it) }
    }

    // ── Screenshots: blocked on student pages, allowed in the admin area ──

    private fun applyScreenshotRule(url: String) {
        if (!BuildConfig.BLOCK_SCREENSHOTS) return
        val path = Uri.parse(url).path ?: ""
        if (path.startsWith("/dashboard/admin")) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    // ── Offline / error screen ────────────────────────────────────────

    private fun showError(url: String) {
        mainFrameFailed = true
        failedUrl = url
        progress.visibility = View.GONE
        val offline = !isOnline()
        findViewById<TextView>(R.id.error_title).setText(if (offline) R.string.offline_title else R.string.error_title)
        findViewById<TextView>(R.id.error_body).setText(if (offline) R.string.offline_body else R.string.error_body)
        errorView.visibility = View.VISIBLE
        web.visibility = View.INVISIBLE
    }

    private fun retry() {
        errorView.visibility = View.GONE
        web.visibility = View.VISIBLE
        val url = failedUrl
        failedUrl = null
        if (url != null) web.loadUrl(url) else web.reload()
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // ── Lifecycle ─────────────────────────────────────────────────────

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        (web.parent as? ViewGroup)?.removeView(web)
        web.destroy()
        super.onDestroy()
    }
}
