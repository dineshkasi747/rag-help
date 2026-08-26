import urllib.request
import json
import time

url = 'https://api.render.com/v1/services/srv-d9ebjq3tqb8s73a62rsg/jobs'
headers = {'Authorization': 'Bearer rnd_u2yoFIp89NiV4qKwMrUx3gvJNz55', 'Content-Type': 'application/json'}
payload = {
    'startCommand': 'python -c "import socket; print(socket.gethostbyname(\'dpg-da781qfavr4c73b7k1h0-a\'))" || echo "FAIL"'
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
try:
    res = urllib.request.urlopen(req)
    job_data = json.loads(res.read())
    job_id = job_data['id']
    print(f"Job triggered: {job_id}")
    
    # Poll for completion
    while True:
        status_req = urllib.request.Request(f"https://api.render.com/v1/services/srv-d9ebjq3tqb8s73a62rsg/jobs/{job_id}", headers=headers)
        status_res = urllib.request.urlopen(status_req)
        status_data = json.loads(status_res.read())
        status = status_data['status']
        print(f"Status: {status}")
        if status in ['succeeded', 'failed']:
            break
        time.sleep(3)
        
except Exception as e:
    print(e.read().decode('utf-8') if hasattr(e, 'read') else e)
