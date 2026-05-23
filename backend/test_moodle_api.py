import requests
import json

token = "2e72a76614f41d268c0acc1134ccbe5b"
base_url = "https://campus.rawdatun.org"
endpoint = f"{base_url}/webservice/rest/server.php"

def test_api():
    params = {
        "wstoken": token,
        "wsfunction": "core_webservice_get_site_info",
        "moodlewsrestformat": "json"
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    try:
        print(f"Testing connection to {endpoint}...")
        resp = requests.post(endpoint, data=params, timeout=15, headers=headers, verify=False)
        print(f"Status Code: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
