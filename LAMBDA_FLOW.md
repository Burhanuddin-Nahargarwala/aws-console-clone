# Lambda Function Flow — Complete Reference

This document explains everything about how Lambda functions work in this AWS Console Simulator: creation, storage, execution, logs, CLI/Python invocation, and region handling.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React UI (Vite, port 5173)               │
└──────────────┬──────────────────────────────┬───────────────────┘
               │ /backend-api/*               │ /s3-api/* (S3, DynamoDB)
               ▼                              ▼
┌─────────────────────────┐      ┌────────────────────────────────┐
│  Express Backend        │      │  Floci (LocalStack-compatible) │
│  port 3001              │◄────►│  port 4566                     │
│  backend/server.js      │      │  Docker container              │
└─────────────────────────┘      └────────────────────────────────┘
               │
               │ reads/writes
               ▼
┌─────────────────────────┐
│  backend/functions/     │
│  *.json files           │
│  (source code + meta)   │
└─────────────────────────┘
```

### Vite Proxy (vite.config.js)
| Path prefix | Forwarded to |
|---|---|
| `/backend-api/*` | `http://localhost:3001` |
| `/s3-api/*` | `http://localhost:4566` |

---

## 1. Why `backend/functions/` Still Exists

Floci stores functions as **ZIP binaries** — you cannot read back the source code from Floci. The `backend/functions/` directory stores a `.json` file per function containing:

```json
{
  "functionName": "my-function",
  "runtime": "nodejs20.x",
  "handler": "index.handler",
  "code": "exports.handler = async (event) => { ... }",
  "region": "ap-south-1",
  "description": "",
  "timeout": 3,
  "memorySize": 128,
  "envVars": {},
  "createdAt": "2026-05-19T06:00:00.000Z",
  "lastModified": "2026-05-19T06:00:00.000Z"
}
```

This file serves 4 purposes:
1. **UI editor** — displays and allows editing of source code
2. **Region filtering** — Floci may return all functions; we filter by `region` field
3. **Startup sync** — on backend start, re-registers all functions into Floci (Floci loses data on restart)
4. **Offline fallback** — if Floci is unreachable, list functions from local files

---

## 2. Function Creation Flow

### Trigger
User fills in function name, selects runtime, clicks **Create function** in `CreateFunction.jsx`.

### Step-by-step

```
CreateFunction.jsx
  └── createFunction({ functionName, runtime, handler, code, region, ... })
        │  (lambdaStore.js)
        │
        ▼
POST /backend-api/lambda/functions
  (Vite proxies to http://localhost:3001/lambda/functions)
        │
        ▼
backend/server.js  — POST /lambda/functions
  │
  ├── 1. registerInFloci({ functionName, runtime, handler, code, region })
  │         │  (flociLambda.js)
  │         │
  │         ├── createZipBuffer("index.js", code)
  │         │     Builds a valid ZIP archive in memory (pure Node.js, no deps)
  │         │     ZIP structure: local file header + file data + central directory
  │         │
  │         ├── zipBuffer.toString('base64')
  │         │
  │         └── POST http://localhost:4566/2015-03-31/functions/
  │               Headers:
  │                 Authorization: AWS4-HMAC-SHA256 Credential=test/20260101/{region}/lambda/aws4_request
  │                 Content-Type: application/json
  │               Body:
  │                 {
  │                   "FunctionName": "my-function",
  │                   "Runtime": "nodejs20.x",
  │                   "Handler": "index.handler",
  │                   "Role": "arn:aws:iam::000000000000:role/lambda-role",
  │                   "Code": { "ZipFile": "<base64 ZIP>" },
  │                   "Timeout": 3,
  │                   "MemorySize": 128,
  │                   "Environment": { "Variables": {} }
  │                 }
  │               → Floci stores the ZIP and registers the function in region ap-south-1
  │
  └── 2. writeMeta(functionName, meta)
            Saves backend/functions/my-function.json
            Contains: source code, region, config, timestamps
```

### ZIP File Structure
Floci needs a valid ZIP to extract and run the code. We build it from scratch:

```
[Local File Header 30 bytes]
  - Signature: 0x04034b50
  - Compression: STORE (no compression, method=0)
  - CRC-32 of file content
  - File size
  - Filename: "index.js" (Node.js) or "lambda_function.py" (Python)

[File Data]
  - Raw source code bytes

[Central Directory Header 46 bytes]
  - Pointer back to local header

[End of Central Directory 22 bytes]
  - Total entry count, size, offset
```

---

## 3. Function Update (Deploy Button)

When user edits code and clicks **Deploy**:

```
FunctionDetail.jsx → updateFunction(name, { code, handler })
  │  (lambdaStore.js)
  ▼
PUT /backend-api/lambda/functions/:name
  │
  ├── updateCodeInFloci(name, code, runtime, config, region)
  │     PUT http://localhost:4566/2015-03-31/functions/{name}/code
  │       Body: { "ZipFile": "<new base64 ZIP>" }
  │
  │     PUT http://localhost:4566/2015-03-31/functions/{name}/configuration
  │       Body: { "Handler": "...", "Timeout": 3, ... }
  │
  └── writeMeta(name, updatedMeta)   — updates the .json file
```

---

## 4. Execution: UI Test Button → Floci

When user clicks **Test** in the UI, execution goes through **Floci's real Lambda runtime** (not our sandbox). This ensures identical behaviour to AWS CLI.

```
FunctionDetail.jsx
  └── POST /backend-api/lambda/invoke/{functionName}
        Body: { code: <current editor content>, event: { ... } }
              │
              ▼
backend/server.js — POST /lambda/invoke/:name

  Step 1: Push latest editor code to Floci
  ─────────────────────────────────────────
  updateCodeInFloci(name, code, runtime, {}, region)
    PUT http://localhost:4566/2015-03-31/functions/{name}/code
    → Ensures the version in Floci always matches what you see in the editor
      (even if you haven't clicked Deploy yet)

  Step 2: Invoke via Floci
  ──────────────────────────
  POST http://localhost:4566/2015-03-31/functions/{name}/invocations
    Headers:
      Authorization: AWS4-HMAC-SHA256 Credential=test/.../lambda/aws4_request
      X-Amz-Log-Type: Tail       ← requests logs in response header
      Content-Type: application/json
    Body: { "key1": "value1", ... }   ← the test event JSON

  Step 3: What Floci does internally
  ────────────────────────────────────
  Floci receives the request and:
    1. Pulls Lambda runtime image (first time only):
       public.ecr.aws/lambda/nodejs:20   or   public.ecr.aws/lambda/python:3.12
    2. Creates a Docker container: floci-{functionName}-{id}
    3. Mounts code from /app/data/lambda-code/{functionName}
    4. Starts the Lambda Runtime API inside the container
    5. Calls your handler with the event payload
    6. Captures stdout/stderr
    7. Returns response + logs

  Step 4: Extract logs
  ─────────────────────
  Floci may return logs in: X-Amz-Log-Result header (base64 encoded)
  If header is empty → fall back to CloudWatch Logs API:
    POST http://localhost:4566/
      X-Amz-Target: Logs_20140328.DescribeLogStreams
      Body: { logGroupName: "/aws/lambda/{name}", orderBy: "LastEventTime", limit: 1 }

    POST http://localhost:4566/
      X-Amz-Target: Logs_20140328.GetLogEvents
      Body: { logGroupName: "...", logStreamName: "...", limit: 100 }

  Step 5: Return to UI
  ─────────────────────
  {
    succeeded: true,
    result: { statusCode: 200, body: "..." },
    duration: 245,          ← measured wall-clock time of the invoke call
    billedDuration: 245,
    memoryUsed: 128,
    logs: [
      "[INFO] Event: {\"key1\":\"value1\"}"
    ]
  }
```

### Container lifecycle
- **Cold start**: First invoke spins up a new container (~2-3 seconds). Floci pulls the runtime image only once.
- **Warm**: Subsequent invokes reuse the running container — fast response.
- **Container name**: `floci-{functionName}-{hash}` (visible in Docker Desktop)

---

## 5. Logs Flow

Every invocation produces logs in multiple places:

```
Lambda function executes
        │
        ├──► CloudWatch Log Group: /aws/lambda/{functionName}
        │      Log Stream: 2026/05/19/[$LATEST]{hash}
        │      Events:
        │        START RequestId: xxx Version: $LATEST
        │        [INFO] Event: {"key1":"value1"}       ← your console.log
        │        END RequestId: xxx
        │        REPORT RequestId: xxx  Duration: 2ms  Billed: 3ms  Memory: 62MB
        │
        ├──► Docker container logs (visible in Docker Desktop)
        │      [lambda:my-function] 2026-05-19T... INFO Event: {...}
        │
        └──► UI Log output panel
               Fetched from CloudWatch after invoke
               Displayed as: [INFO] Event: {"key1":"value1"}
```

### Access CloudWatch logs via CLI
```bash
# List all Lambda log groups
aws logs describe-log-groups \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1

# List log streams for a function
aws logs describe-log-streams \
  --log-group-name /aws/lambda/my-function \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1

# Get log events from a stream
aws logs get-log-events \
  --log-group-name /aws/lambda/my-function \
  --log-stream-name "2026/05/19/[\$LATEST]abc123" \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1
```

---

## 6. Execution via AWS CLI

After a function is created via the UI, it is registered in Floci and can be invoked directly via CLI — our backend is not involved at all.

```bash
# Basic invoke (result written to output.json)
aws lambda invoke \
  --function-name my-function \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1 \
  output.json

cat output.json
# {"statusCode": 200, "body": "\"Hello from Lambda!\""}

# Invoke with a payload
aws lambda invoke \
  --function-name my-function \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"userId": "123", "action": "getProfile"}' \
  output.json

# List all functions in a region
aws lambda list-functions \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1

# Get function details
aws lambda get-function \
  --function-name my-function \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1

# Delete a function
aws lambda delete-function \
  --function-name my-function \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1
```

**CLI flow:**
```
AWS CLI
  └── POST http://localhost:4566/2015-03-31/functions/my-function/invocations
        (Floci receives this directly — backend is not involved)
        │
        ▼
      Floci → Docker container → executes → returns result
```

---

## 7. Execution via Python (boto3)

```python
import boto3
import json

# Create Lambda client pointing to Floci
lambda_client = boto3.client(
    'lambda',
    endpoint_url='http://localhost:4566',
    region_name='ap-south-1',
    aws_access_key_id='test',
    aws_secret_access_key='test'
)

# Invoke a function
response = lambda_client.invoke(
    FunctionName='my-function',
    InvocationType='RequestResponse',   # synchronous
    LogType='Tail',                     # get logs in response
    Payload=json.dumps({"userId": "123"})
)

# Read result
result = json.loads(response['Payload'].read())
print("Result:", result)

# Decode logs (base64)
import base64
logs = base64.b64decode(response.get('LogResult', '')).decode('utf-8')
print("Logs:", logs)

# List functions
functions = lambda_client.list_functions()
for fn in functions['Functions']:
    print(fn['FunctionName'], fn['Runtime'])
```

**Python flow:**
```
boto3
  └── POST http://localhost:4566/2015-03-31/functions/my-function/invocations
        (same Floci API, same execution — backend not involved)
```

---

## 8. Startup Sync

Floci stores data in an ephemeral Docker volume. When Floci restarts, all function registrations are lost. To handle this, the backend automatically re-registers all local functions on startup:

```
node server.js starts
    │
    └── setTimeout(syncFunctionsToFloci, 3000)   ← 3s delay for Floci to be ready
          │
          ├── Read all backend/functions/*.json files
          │
          └── For each function:
                registerInFloci({ functionName, runtime, handler, code, region })
                  → Rebuilds ZIP from stored source code
                  → POST to Floci /2015-03-31/functions/
                  → Logs: [sync] ✓ my-function (ap-south-1)
```

After sync, `aws lambda list-functions` immediately shows all functions.

---

## 9. Region Handling

Lambda functions are region-specific, exactly like real AWS.

| Operation | How region is applied |
|---|---|
| Create | `region` stored in `.json`; Floci receives it in `Authorization` credential scope |
| List | `?region=X` query param → backend filters by `meta.region`, Floci queried with `X` in auth |
| Invoke (UI) | Reads `meta.region` from `.json`, used in Floci auth header |
| Invoke (CLI) | `--region ap-south-1` goes directly to Floci |
| Delete | Reads `meta.region`, passes to Floci delete call |

**Authorization header format** (used by Floci to determine region):
```
AWS4-HMAC-SHA256 Credential=test/20260101/{region}/lambda/aws4_request, SignedHeaders=host, Signature=test
```

When you switch region in the navbar:
1. `changeRegion(code)` updates React Context + localStorage
2. `LambdaList.jsx` `useEffect([region])` fires → calls `listFunctions(region)`
3. Backend queries Floci with the new region + filters local files by `meta.region`
4. Only functions created in that region appear

---

## 10. Summary: Two Execution Paths

| | UI Test Button | CLI / boto3 / SDK |
|---|---|---|
| **Entry point** | `POST /backend-api/lambda/invoke/:name` | Direct to `http://localhost:4566` |
| **Backend involved** | Yes (code upload + invoke proxy) | No |
| **Runtime** | Real Floci Lambda container | Real Floci Lambda container |
| **Logs shown** | Yes — fetched from CloudWatch | In CloudWatch only |
| **Code version** | Current editor content (auto-uploaded) | Last deployed ZIP |
| **Cold start** | Yes (first invoke) | Yes (first invoke) |
| **Identical to real AWS** | Yes | Yes |

---

## 11. Live Code Sync — CLI/Python Changes Reflect in UI

### The Problem (Before Fix)

Before this was solved, the UI editor showed code from `backend/functions/*.json` only. Any code update made via CLI or boto3 went directly to Floci but the local JSON was never updated. This caused two bugs:

```
Developer updates code via CLI
    ↓
Floci has NEW code ✓
backend/functions/my-function.json has OLD code ✗
UI editor shows OLD code ✗

Developer clicks Test in UI
    ↓
Backend uploads editor code (OLD) to Floci  ← CLI changes wiped! ✗
```

### The Fix — Reading Live Code from Floci Container

Every time the UI opens a function detail page, the backend attempts to read the **currently deployed code** directly from Floci using two strategies in order:

#### Strategy 1 — Docker Exec (Primary)

Floci stores extracted Lambda code on its container filesystem at:
```
/app/data/lambda-code/{functionName}/index.js          (Node.js)
/app/data/lambda-code/{functionName}/lambda_function.py (Python)
```

The backend runs `docker exec` to read this file directly:

```
Open function in UI
    ↓
GET /backend-api/lambda/functions/my-function
    ↓
backend/server.js calls getCodeFromFloci(name, runtime, region)
    ↓
getCodeViaDockerExec():
    1. docker ps --filter name=floci  → finds container name (e.g. floci-floci-1)
    2. docker exec floci-floci-1 cat /app/data/lambda-code/my-function/index.js
    → returns raw source code string
    ↓
If code differs from local JSON:
    writeMeta(name, { ...meta, code: liveCode, lastModified: now })
    logs: [get-fn] Code synced from Floci for my-function
    ↓
Editor displays live Floci code ✓
```

#### Strategy 2 — S3 ZIP Download (Fallback)

If docker exec fails (Docker not available, container name mismatch), the backend falls back to:

1. `GET /2015-03-31/functions/{name}` → Floci returns `Code.Location` (AWS-style S3 URL)
2. Convert AWS URL → local Floci URL:
   - `https://awslambda-ap-south-1-tasks.s3.ap-south-1.amazonaws.com/key`
   - → `http://localhost:4566/awslambda-ap-south-1-tasks/key`
3. Download ZIP with S3 fake auth headers
4. Parse ZIP (supports both STORE and DEFLATE compression) → extract source file
5. Return source code

#### Strategy 3 — Cached Local JSON (Last Resort)

If both strategies fail (Floci unreachable, container stopped), the cached `backend/functions/*.json` code is used as a fallback so the UI still loads.

```
Priority order:
  1. docker exec → /app/data/lambda-code/{name}/{file}   ← live, always current
  2. S3 ZIP download → http://localhost:4566/bucket/key   ← live but can fail
  3. backend/functions/{name}.json                        ← cached, may be stale
```

---

### Example 1: Update Code via AWS CLI and See It in UI

**Step 1 — Create a new file with updated code**

```bash
# Write updated Node.js code to a file
cat > updated_handler.js << 'EOF'
exports.handler = async (event) => {
  console.log('Updated via CLI! Event:', JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'This code was deployed via CLI',
      input: event,
    }),
  };
};
EOF
```

**Step 2 — Zip it**

```bash
# Linux/Mac
zip function.zip updated_handler.js

# Windows PowerShell
Compress-Archive -Path updated_handler.js -DestinationPath function.zip -Force
```

> **Important:** The file inside the ZIP must be named `index.js` (for Node.js) or `lambda_function.py` (for Python) — that is the filename Floci maps to the handler.

```bash
# Correct: zip contains index.js
zip function.zip index.js

# For Python
zip function.zip lambda_function.py
```

**Step 3 — Deploy to Floci via CLI**

```bash
aws lambda update-function-code \
  --function-name my-function \
  --zip-file fileb://function.zip \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1
```

Response:
```json
{
    "FunctionName": "my-function",
    "Runtime": "nodejs20.x",
    "Handler": "index.handler",
    "CodeSize": 312,
    "LastModified": "2026-05-19T10:00:00.000+0000",
    ...
}
```

**Step 4 — Open the function in the UI**

Navigate to Lambda → Functions → my-function. The editor will show the updated code deployed via CLI. The backend terminal logs:
```
[sync] Code updated from Floci for my-function
```

**Step 5 — Click Test**

The test now runs the CLI-deployed code through Floci. The log output will show:
```
[INFO] Updated via CLI! Event: {"key1":"value1","key2":"value2","key3":"value3"}
```

---

### Example 2: Update Code via Python (boto3) and See It in UI

```python
import boto3
import zipfile
import io

lambda_client = boto3.client(
    'lambda',
    endpoint_url='http://localhost:4566',
    region_name='ap-south-1',
    aws_access_key_id='test',
    aws_secret_access_key='test'
)

# New code to deploy
new_code = """
exports.handler = async (event) => {
    console.log('Deployed via boto3! Event:', JSON.stringify(event));

    const timestamp = new Date().toISOString();
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello from boto3-deployed Lambda!',
            timestamp,
            input: event
        })
    };
};
"""

# Create ZIP in memory — file inside must be named index.js
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED) as zf:
    zf.writestr('index.js', new_code)
zip_bytes = zip_buffer.getvalue()

# Deploy to Floci
response = lambda_client.update_function_code(
    FunctionName='my-function',
    ZipFile=zip_bytes
)

print(f"Deployed: {response['FunctionName']}")
print(f"Last modified: {response['LastModified']}")
print(f"Code size: {response['CodeSize']} bytes")
```

Output:
```
Deployed: my-function
Last modified: 2026-05-19T10:05:00.000+0000
Code size: 298 bytes
```

**Now open the function in the UI** → editor shows the boto3-deployed code immediately.

---

### Example 3: Create a Function Entirely via Python and See It in UI

You can create a Lambda function directly via boto3 without using the UI at all. After creation, restart the backend so the startup sync registers it locally.

```python
import boto3
import zipfile
import io

lambda_client = boto3.client(
    'lambda',
    endpoint_url='http://localhost:4566',
    region_name='ap-south-1',
    aws_access_key_id='test',
    aws_secret_access_key='test'
)

code = """
import json

def lambda_handler(event, context):
    print(f"Python function! Event: {json.dumps(event)}")
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Created via boto3', 'event': event})
    }
"""

# ZIP — file must be named lambda_function.py for Python
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED) as zf:
    zf.writestr('lambda_function.py', code)
zip_bytes = zip_buffer.getvalue()

response = lambda_client.create_function(
    FunctionName='boto3-python-fn',
    Runtime='python3.12',
    Role='arn:aws:iam::000000000000:role/lambda-role',
    Handler='lambda_function.lambda_handler',
    Code={'ZipFile': zip_bytes},
    Description='Created entirely via boto3',
    Timeout=10,
    MemorySize=256,
)

print(f"Created: {response['FunctionName']} in {response['FunctionArn']}")
```

> **Note:** Functions created directly via CLI/boto3 do NOT have a local `backend/functions/*.json` file, so they will not appear in the UI list or be re-synced on backend restart. To make them fully manageable from the UI, open the function detail once — the backend will detect it from Floci's list and create the local metadata file automatically on the next UI list refresh.

---

### Summary: Code Source of Truth

| Action | Floci updated | Local JSON updated | UI shows correct code |
|---|---|---|---|
| Create via UI | ✓ | ✓ | ✓ |
| Deploy button in UI | ✓ | ✓ | ✓ |
| `aws lambda update-function-code` | ✓ | ✓ on next UI open | ✓ on next UI open |
| `boto3.update_function_code()` | ✓ | ✓ on next UI open | ✓ on next UI open |
| Edit in UI (unsaved) | ✗ | ✗ | ✓ (editor only) |
| Click Test in UI | ✓ (uploads editor code) | ✗ | ✓ |

---

## 12. File Reference

| File | Purpose |
|---|---|
| `src/pages/lambda/LambdaList.jsx` | Functions list page, reloads on region change |
| `src/pages/lambda/CreateFunction.jsx` | Create function form |
| `src/pages/lambda/FunctionDetail.jsx` | Code editor, Test tab, Configuration |
| `src/lib/lambdaStore.js` | Frontend API client → backend |
| `src/lib/RegionContext.jsx` | Global region state (React Context) |
| `backend/server.js` | Express API: CRUD + invoke + sync |
| `backend/flociLambda.js` | Floci API: ZIP builder + HTTP helpers |
| `backend/lambda-runner.js` | (Legacy sandbox — no longer used for Test) |
| `backend/functions/*.json` | Per-function source code + metadata |
