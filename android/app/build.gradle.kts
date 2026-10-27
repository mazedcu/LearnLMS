plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The website the app opens. Change here if the domain ever changes.
val siteHost = "learnwithhasan.xyz"

// Release signing comes from environment variables when building locally.
// Without them the release APK is left unsigned: GitHub Actions publishes it
// that way and the server's deploy script signs it with the key kept on the
// droplet (/root/lms-android-key), so every update has the same signature.
val keystoreFile = System.getenv("LWH_KEYSTORE_FILE")?.let { file(it) }?.takeIf { it.exists() }

android {
    namespace = "xyz.learnwithhasan.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "xyz.learnwithhasan.app"
        minSdk = 24
        targetSdk = 35
        versionCode = (System.getenv("LWH_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("LWH_VERSION_NAME") ?: "1.0"
        buildConfigField("String", "SITE_HOST", "\"$siteHost\"")
        // Block screenshots and screen recording on student pages (paid content).
        buildConfigField("boolean", "BLOCK_SCREENSHOTS", "true")
    }

    signingConfigs {
        if (keystoreFile != null) {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("LWH_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("LWH_KEY_ALIAS")
                keyPassword = System.getenv("LWH_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystoreFile != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.webkit:webkit:1.12.1")
}
