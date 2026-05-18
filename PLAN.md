# AWS Simulator — Master Build Plan

> **Goal:** A zero-cost AWS learning platform where learners practice real AWS workflows — UI navigation, CLI commands, Python/boto3 — without touching a real AWS account. When they graduate to real AWS, the only change is removing the `endpoint_url` parameter.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                       Learner's Browser                        │
│                                                                │
│   React UI  (AWS Console Clone)                               │
│     ↕ AWS SDK v3  (real SDK — identical to production)        │
└────────────┬───────────────────────────────────────────────────┘
             │  HTTP (Vite proxy in dev / Nginx in prod)
     ┌───────┴──────────────────────────────────┐
     │                                          │
     ▼                                          ▼
┌──────────────────────┐            ┌───────────────────────────┐
│   Floci  :4566       │            │  Custom Backend  :3001    │
│  (47 AWS services)   │            │  (Node.js / Express)      │
│                      │            │                           │
│  S3, DynamoDB, SQS,  │            │  Lambda execution sandbox │
│  SNS, IAM, Lambda,   │            │  EC2 Docker containers    │
│  API Gateway, ECR,   │            │  IAM policy enforcement   │
│  ECS, Kinesis,       │            │  WebSocket terminals      │
│  StepFunctions,      │            │  PEM key generation       │
│  CloudWatch, and     │            │  Cleanup scheduler        │
│  40+ more...         │            │                           │
└──────────────────────┘            └───────────────────────────┘
```

**Key principle:** Learners write the same AWS SDK code that runs in production. Moving to real AWS = remove `endpoint_url`. That's it.

---

## Deployment Plan

### Where to Host

**Recommended: AWS EC2 — t3.medium**
- 2 vCPU, 4 GB RAM — comfortable for Floci + backend + Nginx + 10-20 concurrent learners
- Ubuntu 22.04 LTS
- Estimated cost: ~$35/month (EC2 + 20 GB EBS)

This is intentionally deployed on real AWS EC2, which itself teaches learners the first real-world skill: "this whole simulator runs on the thing you're learning."

### Production Architecture on EC2

```
Internet
    │ port 80 / 443
    ▼
 Nginx
    ├── /              →  React static build (dist/)
    ├── /s3-api/*      →  Floci :4566
    ├── /backend-api/* →  Custom backend :3001
    └── /health        →  200 OK (load balancer check)

Docker Compose (all on same EC2)
    ├── floci      (localstack/localstack image)
    ├── backend    (custom Node.js image)
    └── nginx      (nginx:alpine image)
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  floci:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,dynamodb,lambda,iam,sqs,sns,apigateway,ec2,ecs,ecr,
                 kinesis,cloudwatch,logs,secretsmanager,ssm,kms,
                 stepfunctions,events,cognito-idp,rds,elasticache,
                 cloudformation,acm,route53,glue,athena,firehose,
                 ses,es,kafka,codebuild,codedeploy,autoscaling,
                 backup,transfer,eks,bedrock-runtime,elb
      - DEBUG=0
      - LAMBDA_EXECUTOR=local
      - DATA_DIR=/var/lib/localstack/data
    volumes:
      - ./floci-data:/var/lib/localstack/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      - floci
    environment:
      - FLOCI_URL=http://floci:4566
      - PORT=3001

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./aws-console-clone/dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - floci
      - backend
```

### Daily Cleanup at 9 AM IST

Floci exposes a reset endpoint. A cron job calls it every morning:

```bash
# /etc/cron.d/aws-simulator-cleanup
# Resets ALL Floci state (buckets, functions, tables, queues, etc.)
# 9:00 AM IST = 3:30 AM UTC
30 3 * * * root curl -s -X POST http://localhost:4566/_localstack/state/reset

# Also clean backend state (Docker containers for EC2, Lambda logs, etc.)
30 3 * * * root curl -s -X POST http://localhost:3001/admin/reset
```

The reset takes under 2 seconds and requires no downtime. A banner in the UI informs learners:

> ℹ️ **Shared learning environment** — All resources are visible to all learners and are reset daily at 9:00 AM IST. Plan your work accordingly.

### Shared Environment Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Authentication | None initially | Zero friction to start learning |
| Resource visibility | Shared (all learners see all) | Learning environment, not production |
| Resource isolation | Optional namespace prefix | Learner can use their name as prefix: `john-my-bucket` |
| Cleanup cadence | Daily at 9 AM | Keeps environment clean, teaches statelessness |
| EC2 session persistence | Container lives until cleanup | Learner can keep SSH session during the day |

### Deployment Steps

```bash
# 1. Launch EC2 t3.medium, Ubuntu 22.04, 20 GB EBS
# Security Group: allow port 80, 443, 22 (your IP only)

# 2. SSH into EC2 and install Docker + Compose
sudo apt update && sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu

# 3. Clone the repo
git clone <repo-url> /opt/aws-simulator
cd /opt/aws-simulator

# 4. Build the frontend
cd aws-console-clone && npm install && npm run build
cd ..

# 5. Start everything
docker-compose up -d

# 6. Add cleanup cron
sudo cp scripts/cleanup.cron /etc/cron.d/aws-simulator-cleanup

# 7. (Optional) Add domain + SSL via Certbot
sudo certbot --nginx -d your-domain.com
```

### Scaling Consideration

If more than ~20 concurrent learners:
- Upgrade to t3.large (4 GB → 8 GB RAM)
- EC2 instances (Docker containers) are the most memory-intensive part
- Floci itself runs fine on 2 GB

---

## Learning Modes

### The Two-Mode System

When a learner opens the simulator for the first time, a full-screen mode selection appears — no login, no friction, just a choice:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              Welcome to the AWS Learning Simulator                  │
│                                                                     │
│   ┌───────────────────────────┐  ┌───────────────────────────────┐  │
│   │                           │  │                               │  │
│   │   🔍  Sandbox             │  │   🎓  Learning Path           │  │
│   │                           │  │                               │  │
│   │  Explore AWS services     │  │  New to AWS? Start here.      │  │
│   │  freely at your own pace. │  │  Step-by-step guidance        │  │
│   │  No guidance or tasks.    │  │  through every service with   │  │
│   │                           │  │  hands-on tasks, CLI, and     │  │
│   │  Best for:                │  │  Python exercises.            │  │
│   │  • Already know AWS       │  │                               │  │
│   │  • Want to experiment     │  │  Best for:                    │  │
│   │  • Building something     │  │  • Complete beginners         │  │
│   │                           │  │  • Structured learners        │  │
│   │   [ Enter Sandbox ]       │  │  • Exam preparation           │  │
│   │                           │  │                               │  │
│   │                           │  │   [ Start Learning Path ]     │  │
│   │                           │  │                               │  │
│   └───────────────────────────┘  └───────────────────────────────┘  │
│                                                                     │
│   You can switch modes at any time from the top navigation bar.     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The choice is saved in `localStorage`. The learner can switch at any time from the navbar.

---

### Sandbox Mode

Exactly what it sounds like — the full AWS console with no changes. No side panels, no tasks, no validation. Learner has complete freedom to explore, create, break things, and experiment.

Suitable for someone who already has AWS context and just wants a free environment to practice.

---

### Learning Path Mode

This is the core educational product. A structured curriculum sits alongside the AWS console and guides learners from zero to confident.

#### What the UI Looks Like in Learning Path Mode

```
┌──────────────────────────────────────────────────────────────────┐
│  [AWS Navbar — unchanged]                                        │
├──────────────────────────────────────────────────────────────────┤
│                                          │                       │
│   [AWS Console — full, interactive]      │  Learning Panel       │
│                                          │  ────────────────     │
│   The console is fully functional.       │  Module 3: S3         │
│   Learner uses it as normal, but         │  Lesson 2 of 7        │
│   guided steps appear in the right       │  ████████░░░░  60%    │
│   panel telling them what to do.         │                       │
│                                          │  📘 Create a bucket   │
│   When a step is completed, the          │                       │
│   panel advances automatically.          │  In S3, a bucket is   │
│                                          │  your top-level       │
│                                          │  container. Think of  │
│                                          │  it like a hard drive │
│                                          │  in the cloud.        │
│                                          │                       │
│                                          │  Your task:           │
│                                          │  Click "Create bucket"│
│                                          │  and name it:         │
│                                          │  my-first-bucket      │
│                                          │                       │
│                                          │  💡 Hint              │
│                                          │  [ Check my work ]    │
│                                          │                       │
│                                          │  ← Previous  Next →   │
└──────────────────────────────────────────┴───────────────────────┘
```

The console on the left is not locked or restricted. Learner interacts normally — the panel on the right guides them. When they complete a step (e.g., bucket is created), the panel detects it and automatically advances.

---

### Curriculum Structure

The curriculum is defined as a JSON data file — easy to extend as we add services.

```js
// src/curriculum/index.js
export const curriculum = [
  {
    id: 'intro',
    title: 'Introduction to AWS',
    icon: 'AWS',
    lessons: [
      {
        id: 'what-is-cloud',
        title: 'What is Cloud Computing?',
        type: 'theory',
        content: `...markdown content...`,
      },
      {
        id: 'aws-console-tour',
        title: 'Navigating the Console',
        type: 'guided',
        steps: [
          {
            instruction: 'Click the Services grid icon (⊞) in the top navbar to see all AWS services.',
            highlight: '.aws-navbar-btn[title="All services"]',  // CSS selector to pulse-highlight
            validate: null,  // navigation steps don't need validation
          },
          {
            instruction: 'Click on "S3" in the favorites bar at the top.',
            highlight: '.aws-fav-bar-item',
            validate: () => window.location.pathname === '/s3',
          },
        ],
      },
    ],
  },

  {
    id: 's3',
    title: 'Amazon S3',
    icon: 'S3',
    lessons: [
      {
        id: 's3-intro',
        title: 'What is Amazon S3?',
        type: 'theory',
        content: `...`,
      },
      {
        id: 's3-create-bucket-guided',
        title: 'Create Your First Bucket',
        type: 'guided',
        steps: [
          {
            instruction: 'Navigate to S3 using the sidebar or favorites bar.',
            validate: () => window.location.pathname.startsWith('/s3'),
          },
          {
            instruction: 'Click the orange "Create bucket" button in the top right.',
            highlight: 'button.aws-btn-primary',
            validate: () => window.location.pathname === '/s3/bucket/create',
          },
          {
            instruction: 'Enter the bucket name: `my-first-bucket`. Bucket names must be globally unique, lowercase, and 3–63 characters.',
            validate: async () => {
              const data = await s3Client.send(new ListBucketsCommand({}));
              return data.Buckets?.some(b => b.Name === 'my-first-bucket');
            },
          },
        ],
      },
      {
        id: 's3-upload-guided',
        title: 'Upload Your First File',
        type: 'guided',
        steps: [ /* ... */ ],
      },
      {
        id: 's3-folders-guided',
        title: 'Organize with Folders',
        type: 'guided',
        steps: [ /* ... */ ],
      },
      {
        id: 's3-challenge',
        title: 'Challenge: Build a File Archive',
        type: 'task',
        description: `
          Without any guidance, complete the following:
          1. Create a bucket named: photo-archive-[your-name]
          2. Create two folders: "2025" and "2026"
          3. Upload at least one file into each folder
          4. Copy the S3 URI of one of the uploaded files
        `,
        validate: async () => { /* checks all 4 conditions */ },
        successMessage: 'Great work! You now know how to organize files in S3.',
      },
      {
        id: 's3-cli',
        title: 'S3 with AWS CLI',
        type: 'cli',
        steps: [
          {
            instruction: 'The terminal below is pre-configured to connect to our simulator. List your buckets:',
            command: 'aws s3 ls',
            expectedOutputContains: 'my-first-bucket',
          },
          {
            instruction: 'Create a new bucket using the CLI:',
            command: 'aws s3 mb s3://cli-created-bucket',
            expectedOutputContains: 'make_bucket: cli-created-bucket',
          },
          {
            instruction: 'Upload a file. First create a test file, then upload it:',
            command: 'echo "Hello from CLI" > test.txt && aws s3 cp test.txt s3://cli-created-bucket/',
            expectedOutputContains: 'upload:',
          },
          {
            instruction: 'List objects in your bucket:',
            command: 'aws s3 ls s3://cli-created-bucket/',
            expectedOutputContains: 'test.txt',
          },
          {
            instruction: 'On real AWS, the only difference is removing --endpoint-url:',
            note: true,
            content: `
              Simulator:  aws s3 ls   (endpoint pre-configured)
              Real AWS:   aws s3 ls   (identical — no changes needed!)
            `,
          },
        ],
      },
      {
        id: 's3-python',
        title: 'S3 with Python (boto3)',
        type: 'python',
        steps: [
          {
            instruction: 'Run this code to list your buckets using Python:',
            code: `
import boto3

s3 = boto3.client(
    's3',
    endpoint_url='http://localhost:4566',  # Points to our simulator
    aws_access_key_id='test',
    aws_secret_access_key='test',
    region_name='ap-south-1'
)

response = s3.list_buckets()
for bucket in response['Buckets']:
    print(f"Bucket: {bucket['Name']}")
            `,
            validateOutput: (output) => output.includes('my-first-bucket'),
          },
          {
            instruction: 'Now create a bucket and upload a file programmatically:',
            code: `
import boto3

s3 = boto3.client('s3', endpoint_url='http://localhost:4566',
                  aws_access_key_id='test', aws_secret_access_key='test',
                  region_name='ap-south-1')

# Create bucket
s3.create_bucket(Bucket='python-created-bucket')
print("Bucket created!")

# Upload a file
s3.put_object(
    Bucket='python-created-bucket',
    Key='hello.txt',
    Body=b'Hello from Python!'
)
print("File uploaded!")

# List objects
response = s3.list_objects_v2(Bucket='python-created-bucket')
for obj in response.get('Contents', []):
    print(f"Object: {obj['Key']} ({obj['Size']} bytes)")
            `,
          },
          {
            instruction: 'Moving to real AWS: just remove the endpoint_url line.',
            note: true,
            content: `
              # Simulator version:
              s3 = boto3.client('s3', endpoint_url='http://your-server:4566', ...)
              
              # Real AWS version:
              s3 = boto3.client('s3')  # That's it!
            `,
          },
        ],
      },
    ],
  },
  // ... more modules for Lambda, EC2, DynamoDB, etc.
];
```

---

### Lesson Types

| Type | Description | Components Used |
|---|---|---|
| `theory` | Reading content — what is this service, key concepts | Markdown renderer, diagrams |
| `guided` | Step-by-step with console highlighting | Learning panel + UI highlighter |
| `task` | Unguided challenge — learner does it alone, validation checks answer | Learning panel + Check button |
| `cli` | Terminal session with command guidance | xterm.js embedded terminal |
| `python` | Python code editor with runnable exercises | Monaco editor + backend runner |

---

### Learning Panel Component

The right-side panel that appears in Learning Path mode:

```
Learning Panel states:
  theory  → Rendered markdown with "Next →" button
  guided  → Current step instruction + optional hint + auto-advance on validation
  task    → Task description + "Check my work" button + success/fail feedback
  cli     → Instruction + command to copy + "Check output" validator
  python  → Instruction + Monaco code editor + "Run" button + output panel
```

**Auto-advance behavior (guided steps):**
- After each action (bucket created, file uploaded), the panel polls the validation function every 2 seconds
- When validation passes: green flash on the step, auto-advance to next step
- Learner doesn't have to click anything — the panel tracks their progress naturally

**UI highlighting:**
- `highlight` field on a step contains a CSS selector
- The element matching that selector gets a pulsing orange ring (like a product tour)
- Draws the learner's eye to where they need to click

---

### Embedded Terminal (CLI Mode)

For CLI lessons, an xterm.js terminal appears in the learning panel (or full-screen):

```
┌──────────────────────────────────────────────────────┐
│  AWS CLI Terminal                          [⛶ Full]  │
├──────────────────────────────────────────────────────┤
│  $ aws s3 ls                                         │
│  2026-05-17 10:23:45 my-first-bucket                 │
│  2026-05-17 10:25:12 python-created-bucket           │
│  $                                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Pre-configured environment:**
The terminal shell has these env vars set automatically so learners type clean `aws` commands — no `--endpoint-url` required:

```bash
export AWS_DEFAULT_REGION=ap-south-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_ENDPOINT_URL=http://localhost:4566   # AWS CLI v2 respects this env var
```

With `AWS_ENDPOINT_URL` set, `aws s3 ls` works exactly like real AWS from the learner's perspective. When they move to real AWS, they just don't set that env var. Same commands.

**Backend:** xterm.js WebSocket → backend → `docker exec` into a pre-built `aws-cli-sandbox` container with Python, boto3, AWS CLI, and common tools pre-installed.

---

### Embedded Python Editor (Python Mode)

For Python lessons, a Monaco editor appears with runnable code:

```
┌──────────────────────────────────────────────────────┐
│  Python Editor                            [ ▶ Run ]  │
├──────────────────────────────────────────────────────┤
│  import boto3                                        │
│                                                      │
│  s3 = boto3.client(                                  │
│      's3',                                           │
│      endpoint_url='http://localhost:4566',           │
│      ...                                             │
│  )                                                   │
│                                                      │
│  response = s3.list_buckets()                        │
│  print(response['Buckets'])                          │
├──────────────────────────────────────────────────────┤
│  Output:                                             │
│  [{'Name': 'my-first-bucket', 'CreationDate': ...}]  │
│  ✅ Correct! my-first-bucket is listed.              │
└──────────────────────────────────────────────────────┘
```

**Execution:** Code is sent to our backend Python sandbox (same one used for Lambda). Output is streamed back. Validation checks the output or the Floci state.

---

### Progress Tracking

Stored in `localStorage` — no server, no login needed.

```js
// localStorage key: 'aws-simulator-progress'
{
  "mode": "learning",
  "completedLessons": ["intro/what-is-cloud", "intro/aws-console-tour", "s3/s3-intro"],
  "currentLesson": "s3/s3-create-bucket-guided",
  "currentStep": 2,
  "lastSeen": "2026-05-18T10:30:00Z"
}
```

**Progress bar in navbar (Learning Path mode):**
```
🎓 Learning Path  [████████░░░░░░░]  8 / 42 lessons
```

**Left sidebar replacement (Learning Path mode):**
Instead of the AWS service sidebar, a curriculum tree shows module progress:

```
📋 Your Progress
  ✅ Introduction to AWS
  ⏳ Amazon S3  (lesson 3 of 7)
     ✅ What is S3?
     ✅ Create your first bucket
     ▶  Upload a file  ← current
     ○  Create folders
     ○  Challenge
     ○  S3 with CLI
     ○  S3 with Python
  ○ Amazon Lambda
  ○ Amazon EC2
  ○ Amazon DynamoDB
  ...
```

---

### Full Curriculum Outline

#### Module 0: Introduction to AWS (no service needed)
- What is cloud computing and why AWS?
- AWS global infrastructure (regions, AZs, edge locations)
- The AWS Console — navigation, search, favorites, regions
- AWS pricing model — pay-as-you-go (and why this simulator exists)
- Setting up the AWS CLI (pre-configured here, manual setup for real AWS)

#### Module 1: Amazon S3
- What is object storage? S3 concepts (buckets, objects, keys, prefixes)
- **Guided:** Create a bucket → upload files → create folders → download
- **Task:** Build a folder structure for a photo archive
- **CLI:** `aws s3 mb`, `aws s3 cp`, `aws s3 ls`, `aws s3 rm`, `aws s3 sync`
- **Python:** `create_bucket`, `put_object`, `get_object`, `list_objects_v2`, `delete_object`

#### Module 2: Amazon DynamoDB
- What is NoSQL? DynamoDB concepts (tables, items, partition key, sort key)
- **Guided:** Create a table → add items → query → scan
- **Task:** Design and populate a user activity table
- **CLI:** `aws dynamodb create-table`, `put-item`, `get-item`, `query`, `scan`
- **Python:** `create_table`, `put_item`, `get_item`, `query`, `scan`, `update_item`

#### Module 3: AWS Lambda
- What is serverless? Lambda concepts (functions, triggers, runtime, handler)
- **Guided:** Write a function → test with event → read logs
- **Task:** Write a function that processes an S3 event
- **CLI:** `aws lambda create-function`, `invoke`, `update-function-code`
- **Python:** `create_function`, `invoke`, `update_function_code`

#### Module 4: Amazon EC2
- What is compute? EC2 concepts (instances, AMIs, instance types, key pairs, security groups)
- **Guided:** Launch an instance → download PEM → connect via browser terminal
- **Guided:** Install nginx inside the instance → verify it's running
- **Task:** Launch, configure, and connect to your own Linux server
- **CLI:** `aws ec2 run-instances`, `describe-instances`, `start-instances`, `terminate-instances`
- **Python:** `run_instances`, `describe_instances`, `terminate_instances`

#### Module 5: AWS IAM
- What is IAM? Concepts (users, groups, roles, policies, least-privilege)
- **Guided:** Create a user → deny all S3 access → test the denial → add policy → test success
- **Guided:** Create a role → attach to Lambda → test cross-service access
- **Task:** Set up a team of 3 users with different S3 permissions
- **CLI:** `aws iam create-user`, `put-user-policy`, `attach-user-policy`
- **Python:** `create_user`, `put_user_policy`, `create_role`, `attach_role_policy`

#### Module 6: SQS + SNS
- Messaging concepts: queues vs topics, pub-sub, fan-out
- **Guided:** Create SQS queue → send messages → receive messages → trigger Lambda
- **Guided:** Create SNS topic → subscribe SQS → publish → watch messages arrive
- **Task:** Build a notification pipeline: SNS → SQS → Lambda processor
- **CLI + Python** for both services

#### Module 7: AWS API Gateway
- What is an API Gateway? REST vs HTTP APIs, routes, integrations, stages
- **Guided:** Create HTTP API → add Lambda integration → deploy → test with curl
- **Task:** Build a simple CRUD API backed by Lambda + DynamoDB
- **CLI + Python**

#### Module 8: ECS + ECR
- Containers vs VMs, Docker basics, task definitions, services, clusters
- **Guided:** Build a Docker image → push to ECR → create task definition → run as ECS service
- **Task:** Deploy a web application container to ECS

#### Module 9: CloudWatch
- Observability: logs, metrics, alarms
- **Guided:** View Lambda logs → create a metric filter → set up an alarm
- **Task:** Set up monitoring for an S3 + Lambda pipeline

#### Module 10: Step Functions
- Workflow orchestration: state machines, states, transitions, error handling
- **Guided:** Create a state machine → run it → watch each state progress
- **Task:** Build a multi-step data processing workflow

#### Module 11: Advanced — Putting It All Together
- **Capstone Lab 1:** Serverless image processor (S3 upload → Lambda → DynamoDB → SNS notification)
- **Capstone Lab 2:** REST API backend (API Gateway → Lambda → DynamoDB → IAM roles)
- **Capstone Lab 3:** CI/CD pipeline simulation (CodeBuild → ECR → ECS deploy)

---

### Technical Components to Build

| Component | File | Description |
|---|---|---|
| Mode selection screen | `src/pages/ModeSelect.jsx` | Full-screen choice on first load |
| Curriculum data | `src/curriculum/index.js` | All modules, lessons, steps as JSON |
| Learning panel | `src/components/learn/LearningPanel.jsx` | Right-side guided panel |
| Progress tracker | `src/components/learn/ProgressSidebar.jsx` | Left curriculum tree |
| UI highlighter | `src/components/learn/StepHighlight.jsx` | CSS pulse ring on elements |
| Step validator | `src/hooks/useStepValidator.js` | Polls validation function, auto-advances |
| Embedded terminal | `src/components/learn/CliTerminal.jsx` | xterm.js + WebSocket |
| Python editor | `src/components/learn/PythonEditor.jsx` | Monaco + run button + output |
| Progress store | `src/hooks/useProgress.js` | localStorage read/write |
| Lesson renderer | `src/components/learn/LessonRenderer.jsx` | Routes to correct lesson type |

---

### Learning Path Checklist
- [ ] Mode selection screen (Sandbox vs Learning Path)
- [ ] Learning panel component (right side, collapsible)
- [ ] Curriculum data structure (`curriculum/index.js`)
- [ ] Theory lesson renderer (markdown)
- [ ] Guided lesson renderer (steps + highlight + auto-validate)
- [ ] Task lesson renderer (description + check button + feedback)
- [ ] CLI lesson renderer (terminal + command guide)
- [ ] Python lesson renderer (Monaco editor + run + output)
- [ ] UI element highlighter (pulsing orange ring)
- [ ] Step auto-advance on validation pass
- [ ] Progress tracking in localStorage
- [ ] Progress sidebar (curriculum tree with completion status)
- [ ] Progress bar in navbar
- [ ] Hint system (hidden, revealed on click)
- [ ] Embedded terminal pre-configured with Floci env vars
- [ ] Embedded Python editor with backend execution
- [ ] Curriculum: Module 0 (Introduction)
- [ ] Curriculum: Module 1 (S3 — all 7 lessons)
- [ ] Curriculum: Modules 2–11 (one per service)

---

## IAM — Realistic Permission Enforcement

Floci's IAM API is running but doesn't enforce policies — every call succeeds regardless of permissions. We add our own enforcement layer to teach one of AWS's most important concepts.

### How Our IAM Enforcement Works

```
Learner clicks "List Objects" in S3 UI
           ↓
Our frontend calls: GET /backend-api/iam/check
  { user: "alice", action: "s3:ListObjects", resource: "arn:aws:s3:::my-bucket/*" }
           ↓
Backend evaluates attached policies using IAM evaluation logic:
  1. Any explicit Deny?  → Return AccessDenied immediately
  2. Any explicit Allow? → Forward call to Floci
  3. Default             → Return AccessDenied
           ↓
If allowed: Forward to Floci, return real result
If denied:  Return { error: "AccessDenied", message: "User arn:aws:iam::000000000000:user/alice 
            is not authorized to perform: s3:ListObjects on resource: arn:aws:s3:::my-bucket/*" }
```

The error message format is identical to real AWS. Learners get the exact same experience they'll see in production.

### Backend IAM Storage (SQLite)

```
backend/iam.db
  users     (id, name, arn, created_at)
  groups    (id, name, arn, created_at)
  roles     (id, name, arn, trust_policy, created_at)
  policies  (id, name, arn, document, created_at)
  user_policies    (user_id, policy_id)
  group_policies   (group_id, policy_id)
  role_policies    (role_id, policy_id)
  user_groups      (user_id, group_id)
```

### IAM UI Pages

**Users** — Create/delete IAM users, attach policies, add to groups
**Groups** — Create groups, attach policies, add users
**Roles** — Create roles with trust policies, attach permission policies
**Policies** — Visual policy editor + JSON editor
**Policy Simulator** — Test: "Can user Alice call s3:PutObject on my-bucket?" → Allow/Deny with explanation

### Learner Workflow (the key educational experience)

```
1. Create IAM user "alice"
2. Try to list S3 buckets as alice → AccessDenied ❌
3. Create policy "S3ReadOnly" with s3:ListBuckets, s3:GetObject
4. Attach policy to alice
5. List S3 buckets as alice → Success ✅
6. Try to upload as alice → AccessDenied ❌ (s3:PutObject not in policy)
7. "Aha!" moment — understand least-privilege principle
```

This is one of the hardest concepts to learn in real AWS because the feedback loop is slow (create user → configure CLI → test). Our UI makes it instant.

### Complexity Assessment: **Medium** — but highest educational ROI of any feature.

---

## Service Implementation Phases

### Phase 1 — S3 (Complete Existing Work)

**Floci support:** Full  
**Custom backend needed:** No  
**Estimated effort:** 3–4 days

#### Gaps to Fix

**1. Folder Navigation** *(Critical)*
- `prefix` is hardcoded to `''` in `BucketDetails.jsx:390`
- Add URL-based prefix: route changes to `/s3/bucket/:bucketName/*`
- Use `ListObjectsV2Command` with `Delimiter: '/'` and `Prefix: currentPrefix`
- Returns `CommonPrefixes` (folders) + `Contents` (files at this level only)
- Clicking a folder navigates deeper; breadcrumb updates dynamically

**2. Object Name Links Don't Navigate** *(Critical)*
- Folders → navigate into prefix
- Files → open Object Details page (key, size, ETag, storage class, S3 URI, download)

**3. Copy S3 URI / Copy URL** *(High)*
- `navigator.clipboard.writeText('s3://' + bucketName + '/' + key)`
- Show brief "Copied!" toast (same style as real AWS)

**4. Download Object** *(High)*
- `GetObjectCommand` → stream response → trigger browser download

**5. Delete Bucket** *(High)*
- `DeleteBucketCommand` with name-confirmation modal (user types bucket name)
- Handle `BucketNotEmpty` error with prompt to empty first

**6. Empty Bucket** *(Medium)*
- Paginated `ListObjectsV2` → `DeleteObjectsCommand` in batches of 1000
- Progress modal showing items deleted

**7. Delete Confirmation Modal** *(Medium)*
- Replace `window.confirm()` with proper AWS-style modal
- User types "permanently delete" to confirm

**8. Flat Object Listing** *(Critical)*
- Add `Delimiter: '/'` so only top-level items show
- Without this, `folder/file.txt` appears as a flat row instead of navigating into `folder/`

**9. Properties Tab** *(Low)*
- Pass region from global context (not hardcoded "ap-south-1")
- Show real versioning/encryption status from `GetBucketVersioning` / `GetBucketEncryption`

**10. Copy ARN / Actions Dropdown** *(Low)*
- Wire all Actions dropdown items (Download, Open, Copy S3 URI, Copy URL, Delete)

#### Phase 1 Checklist
- [ ] Folder navigation with URL prefix + breadcrumb
- [ ] Object/folder name links navigate correctly
- [ ] Copy S3 URI + Copy URL with toast
- [ ] Download object
- [ ] Delete bucket with name-confirmation modal
- [ ] Empty bucket with batch delete + progress
- [ ] Delete objects with proper modal
- [ ] `Delimiter: '/'` for folder-level listing
- [ ] Object details page
- [ ] Properties tab with real data
- [ ] All Actions dropdown items wired

---

### Phase 2 — Lambda

**Floci support:** API complete; code execution needs sandbox  
**Custom backend needed:** Yes (execution engine)  
**Estimated effort:** 1 week

#### What We Build

**Frontend pages:**
- `/lambda` — Functions list (name, runtime, last modified, description)
- `/lambda/create` — Create function (name, runtime, architecture, execution role)
- `/lambda/function/:name` — Function detail with tabs

**Function detail tabs:**
- **Code** — Monaco editor (same editor real AWS uses), language-aware syntax
- **Test** — JSON event editor + "Test" button → execution result panel
- **Configuration** — Timeout (3–900s), memory (128–10240 MB), env vars, description
- **Monitor** — Recent invocation list with duration and status

**Execution result panel (pixel-matched to real AWS):**
```
┌─────────────────────────────────────────────────────┐
│ ✅ Execution result: Succeeded                      │
├─────────────────────────────────────────────────────┤
│ Response                                            │
│ { "statusCode": 200, "body": "Hello World" }        │
│                                                     │
│ Function logs                                       │
│ START RequestId: a3f2-4d8c  Version: $LATEST        │
│ 2026-05-17T10:23:14.123Z  INFO  Processing event   │
│ END RequestId: a3f2-4d8c                            │
│ REPORT Duration: 142.30 ms  Billed: 200 ms         │
│         Memory: 128 MB      Max used: 47 MB        │
└─────────────────────────────────────────────────────┘
```

**Backend execution (`backend/lambda-runner.js`):**

| Runtime | Execution method |
|---|---|
| Node.js 18/20 | `vm.runInNewContext()` with mocked `console` + timeout |
| Python 3.11/12 | `python3 -c` child_process with timeout + stdout capture |

```js
// Node.js execution
const vm = require('vm');
const logs = [];
const ctx = vm.createContext({
  console: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push('ERROR: ' + a.join(' ')) },
  event, context: { functionName, awsRequestId: uuid() }
});
const start = Date.now();
const result = vm.runInContext(userCode, ctx, { timeout: timeoutMs });
const duration = Date.now() - start;
```

**Phase 2 Checklist**
- [ ] Custom backend server (`backend/server.js`)
- [ ] Lambda functions list page
- [ ] Create function page (Node.js + Python runtimes)
- [ ] Monaco code editor integration
- [ ] Test tab with JSON event editor
- [ ] Execution result panel (AWS log format)
- [ ] Node.js vm sandbox execution
- [ ] Python child_process execution
- [ ] Configuration tab (timeout, memory, env vars)
- [ ] Monitor tab with invocation history
- [ ] Lambda triggers (S3 event trigger setup UI — connects to EventBridge)

---

### Phase 3 — EC2

**Floci support:** API complete; actual compute needs Docker  
**Custom backend needed:** Yes (Docker + WebSocket terminal)  
**Estimated effort:** 1.5 weeks

#### What We Build

**Frontend pages:**
- `/ec2/instances` — Instance list with state badges (running/stopped/terminated)
- `/ec2/launch` — 6-step launch wizard
- `/ec2/instances/:id` — Instance detail (Description, Security, Networking, Storage tabs)

**6-step Launch Wizard:**
1. Name and tags
2. AMI selection (Amazon Linux 2023, Ubuntu 22.04, Ubuntu 20.04 — all map to `ubuntu:22.04` Docker image, labels only)
3. Instance type (t2.micro, t2.small, t3.micro — with Free Tier eligible badge)
4. Key pair (create new → generates RSA-4096 keypair → `.pem` download)
5. Network settings (security group, SSH access toggle)
6. Storage (root volume size — cosmetic only)

**Connect dialog (matches real AWS "EC2 Instance Connect"):**
```
Connect to instance: i-0abc123def456789

Connection method: ● EC2 Instance Connect  ○ SSH client

SSH client instructions:
1. Open an SSH client
2. Locate your private key: my-key.pem
3. Run: chmod 400 "my-key.pem"
4. Connect: ssh -i "my-key.pem" ec2-user@54.210.167.204

[ Open in browser terminal ]
```

**Browser terminal (xterm.js + WebSocket):**
- Opens as a panel or new tab in the UI
- WebSocket → backend → `docker exec` → bash shell in the container
- Real Linux environment: `apt install`, `python3`, run web servers, configure files

**Backend services:**
```js
// Launch: creates Docker container + generates key pair
POST /backend-api/ec2/launch
  → docker.createContainer({ Image: 'ubuntu:22.04', ... })
  → forge.pki.rsa.generateKeyPair(4096)
  → store publicKey in container ~/.ssh/authorized_keys
  → return { instanceId, publicIp, pemContent }

// Terminal: WebSocket bridge to container
GET /backend-api/ec2/terminal/:instanceId  (WebSocket)
  → container.exec({ Cmd: ['/bin/bash'], AttachStdin: true, AttachStdout: true, Tty: true })
  → pipe WebSocket ↔ container exec stream

// Stop / Start / Terminate
POST /backend-api/ec2/:instanceId/stop      → container.pause()
POST /backend-api/ec2/:instanceId/start     → container.unpause()
POST /backend-api/ec2/:instanceId/terminate → container.stop() + container.remove()
```

**Phase 3 Checklist**
- [ ] Backend: Docker container lifecycle (launch, stop, start, terminate)
- [ ] Backend: RSA key pair generation + PEM download
- [ ] Backend: WebSocket-to-container shell bridge
- [ ] Instances list page with state badges
- [ ] 6-step launch wizard
- [ ] Instance detail page (Description, Security, Networking, Storage tabs)
- [ ] Connect modal with SSH instructions
- [ ] xterm.js browser terminal
- [ ] Start / Stop / Reboot / Terminate actions with confirmation
- [ ] Security Groups list + create (cosmetic UI, concepts only)
- [ ] Key Pairs management page

---

### Phase 4 — DynamoDB

**Floci support:** Full native  
**Custom backend needed:** No  
**Estimated effort:** 4–5 days

#### What We Build

**Frontend pages:**
- `/dynamodb` — Tables list
- `/dynamodb/create` — Create table form
- `/dynamodb/table/:name` — Table detail

**Create table form:**
- Table name
- Partition key (name + type: String / Number / Binary)
- Sort key (optional)
- Read/Write capacity: On-demand (default) or Provisioned (with read/write unit inputs)
- Global Secondary Indexes (add up to 5)

**Table detail tabs:**
- **Items** — Full data browser: create, read, edit, delete items; Query and Scan modes with filter builder
- **Overview** — ARN, partition key, sort key, item count, status, capacity mode
- **Indexes** — List of GSIs and LSIs
- **Backups** — Stub (cosmetic)
- **Metrics** — Stub (cosmetic)

**Item editor modal:**
- Form view: each attribute is a labeled input with type selector (S / N / BOOL / L / M / NULL)
- JSON view: raw JSON editor for power users
- Toggle between views preserves data

**Query builder:**
```
Mode: ● Query  ○ Scan

Partition key: userId = [ "user123" ]
Filter:        [ createdAt ] [ >= ] [ 2026-01-01 ]
Sort:          ● Ascending  ○ Descending
Limit:         [ 100 ]

[ Run ]
```

**Phase 4 Checklist**
- [ ] Tables list with Create / Delete actions
- [ ] Create table (partition key, sort key, capacity, GSIs)
- [ ] Items tab — full CRUD
- [ ] Item editor (form view + JSON view toggle)
- [ ] Query mode with key conditions and filters
- [ ] Scan mode with filter expressions
- [ ] Overview tab with real metadata (`DescribeTable`)
- [ ] Indexes tab

---

### Phase 5 — IAM

**Floci support:** API complete  
**Custom backend needed:** Yes (enforcement layer)  
**Estimated effort:** 1 week

#### What We Build

**Frontend pages:**
- `/iam` — Dashboard (user/role/policy/group counts)
- `/iam/users` — Users list, create user, attach policies, add to groups
- `/iam/groups` — Groups list, create group, attach policies
- `/iam/roles` — Roles list, create role (with trust policy editor), attach policies
- `/iam/policies` — Policies list, create policy (visual editor + JSON editor)
- `/iam/simulator` — Policy simulator

**Visual policy editor (matching real AWS):**
```
Add permissions:
  Service: [ S3          ▼ ]
  Actions:  ● All S3 actions
            ○ Select specific:
              [x] s3:GetObject
              [x] s3:ListBucket
              [ ] s3:PutObject
              [ ] s3:DeleteObject
  Resources: ● All resources  ○ Specific ARN
```

**Policy Simulator:**
Input: user, action (e.g. `s3:PutObject`), resource (`arn:aws:s3:::my-bucket/file.txt`)
Output: `✅ Allow` or `❌ Deny — no matching policy allows this action`

**"Switch user" feature in navbar:**
- Learner can switch between IAM users in the top navbar (like real AWS role switching)
- Selected user's policies apply to all subsequent UI actions
- This makes the enforcement visible and interactive

**Backend enforcement:**
```js
// Called by frontend before every AWS operation
POST /backend-api/iam/evaluate
  Body: { principalArn, action, resourceArn }
  Returns: { allowed: true/false, reason: "..." }
```

**Phase 5 Checklist**
- [ ] Backend: SQLite schema for users/roles/groups/policies
- [ ] Backend: IAM policy evaluation engine (explicit deny → explicit allow → default deny)
- [ ] Frontend: IAM dashboard
- [ ] Users CRUD + policy attachment
- [ ] Groups CRUD + policy attachment + user membership
- [ ] Roles CRUD + trust policy + permission policies
- [ ] Visual policy editor
- [ ] JSON policy editor with schema validation
- [ ] Policy simulator
- [ ] "Switch user" in navbar with policy enforcement in UI
- [ ] AccessDenied error display (exact AWS error format)

---

### Phase 6 — SQS + SNS

**Floci support:** Both fully supported  
**Custom backend needed:** No  
**Estimated effort:** 4–5 days

#### SQS — Simple Queue Service

**Pages:**
- `/sqs` — Queues list (Standard + FIFO)
- `/sqs/create` — Create queue (name, type, visibility timeout, retention, DLQ)
- `/sqs/queue/:name` — Queue detail

**Queue detail tabs:**
- **Send and receive messages** — Key tab. Learner types a message → sends it → polls the queue → sees the message appear. This is the core SQS learning loop.
- **Messages** — View messages in flight
- **Monitoring** — Message count, approximate age
- **Dead-Letter Queue** — Configure DLQ, view DLQ contents

**The learning moment:** Send 5 messages, set a Lambda to trigger on the queue, watch messages get consumed. Connects SQS + Lambda concepts.

#### SNS — Simple Notification Service

**Pages:**
- `/sns` — Topics list
- `/sns/create` — Create topic (Standard / FIFO)
- `/sns/topic/:arn` — Topic detail

**Topic detail:**
- **Publish message** — Publish text to topic, watch subscriptions receive it
- **Subscriptions** — Add SQS queue or Lambda as subscriber
- **Access policy** — JSON editor

**Phase 6 Checklist**
- [ ] SQS queue list + create (Standard + FIFO)
- [ ] Queue detail: Send + receive messages tab (functional)
- [ ] Queue detail: Visibility timeout, retention settings
- [ ] Dead-letter queue configuration
- [ ] SNS topic list + create
- [ ] Topic: Publish message
- [ ] Topic: Manage subscriptions (SQS, Lambda, Email endpoints)
- [ ] SQS → Lambda trigger wiring (connects Phase 2 Lambda)

---

### Phase 7 — API Gateway

**Floci support:** REST (v1) + HTTP (v2) APIs  
**Custom backend needed:** Partial (for Lambda integration wiring)  
**Estimated effort:** 1 week

#### What We Build

This teaches the full serverless architecture: HTTP request → API Gateway → Lambda → response.

**Pages:**
- `/apigateway` — APIs list (REST, HTTP, WebSocket)
- `/apigateway/create` — Create API wizard (REST / HTTP / WebSocket)
- `/apigateway/api/:id` — API detail

**API detail:**
- **Routes** — Define routes: `GET /users`, `POST /users`, etc.
- **Integrations** — Attach Lambda function to each route
- **Deploy** — Deploy to a stage (dev/prod) → get invoke URL
- **Test console** — Send HTTP requests directly from the UI and see Lambda response

**The learning moment:**
```
1. Create Lambda function that returns JSON
2. Create API Gateway HTTP API
3. Add route: GET /hello → Lambda integration
4. Deploy to "dev" stage
5. Get URL: https://abc123.execute-api.localhost/dev/hello
6. Call it from browser or curl — see Lambda response
```

**Phase 7 Checklist**
- [ ] APIs list + create (REST / HTTP / WebSocket)
- [ ] Routes editor (method + path)
- [ ] Lambda integration setup
- [ ] Stage deployment (creates invoke URL)
- [ ] In-UI test console (send requests, see response + logs)
- [ ] CORS settings
- [ ] Authorization (API Key, Cognito — stub)

---

### Phase 8 — ECS + ECR

**Floci support:** Both APIs complete  
**Custom backend needed:** Yes (Docker for actual container runs)  
**Estimated effort:** 1.5 weeks

#### ECR — Elastic Container Registry

**Pages:**
- `/ecr` — Repositories list
- `/ecr/create` — Create repository
- `/ecr/repo/:name` — Repository detail (images list, push commands)

**Push commands panel (matches real AWS exactly):**
```bash
# Authenticate
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin 000000000000.dkr.ecr.ap-south-1.localhost:4566

# Tag your image
docker tag my-app:latest 000000000000.dkr.ecr.ap-south-1.localhost:4566/my-repo:latest

# Push
docker push 000000000000.dkr.ecr.ap-south-1.localhost:4566/my-repo:latest
```
These commands work with the real Docker CLI against Floci's ECR.

#### ECS — Elastic Container Service

**Pages:**
- `/ecs` — Clusters list
- `/ecs/create-cluster` — Create cluster
- `/ecs/cluster/:name` — Cluster detail (Services, Tasks, Metrics tabs)
- `/ecs/task-definitions` — Task definition list
- `/ecs/task-definition/create` — Register task definition

**Task definition form:**
- Family name, container name, Docker image (from ECR or Docker Hub)
- CPU / Memory allocation
- Port mappings
- Environment variables

**Service and task execution:**
- Create service → our backend runs the Docker container
- View running tasks with container status, logs
- Logs panel shows real container stdout

**Phase 8 Checklist**
- [ ] ECR repositories CRUD
- [ ] ECR push/pull commands panel
- [ ] ECR image list per repository
- [ ] ECS clusters CRUD
- [ ] Task definition register/deregister
- [ ] Service create/update/delete
- [ ] Backend: run Docker containers from task definitions
- [ ] Task logs viewer (real container stdout)
- [ ] Fargate launch type UI (no EC2 selection needed)

---

### Phase 9 — CloudWatch

**Floci support:** CloudWatch Logs (full) + Metrics (partial) + Alarms (partial)  
**Custom backend needed:** No  
**Estimated effort:** 4–5 days

#### What We Build

CloudWatch is the observability layer for everything else — Lambda execution logs, EC2 system logs, API Gateway access logs all land here.

**Pages:**
- `/cloudwatch/logs` — Log groups list
- `/cloudwatch/logs/:group` — Log streams list
- `/cloudwatch/logs/:group/:stream` — Log events viewer (with live tail toggle)
- `/cloudwatch/metrics` — Metrics browser (service → namespace → metric → graph)
- `/cloudwatch/alarms` — Alarms list + create

**Log viewer features:**
- Search/filter by log text
- Time range picker
- Live tail mode (polls every 3s, shows new log lines as they arrive)
- JSON pretty-printing for structured logs

**Phase 9 Checklist**
- [ ] Log groups list + create
- [ ] Log streams list per group
- [ ] Log events viewer with search + time filter
- [ ] Live tail mode
- [ ] Metrics browser (namespace tree → metric graph)
- [ ] Alarm list + create (metric threshold → notification)
- [ ] Auto-wire Lambda logs → CloudWatch log groups

---

### Phase 10 — StepFunctions

**Floci support:** Full  
**Custom backend needed:** No  
**Estimated effort:** 4–5 days

#### What We Build

Step Functions teaches workflow orchestration — the visual state machine is one of AWS's most impressive UIs to replicate.

**Pages:**
- `/stepfunctions` — State machines list
- `/stepfunctions/create` — Create state machine (name + ASL JSON editor)
- `/stepfunctions/statemachine/:arn` — State machine detail

**Visual workflow renderer:**
- Parse Amazon States Language (ASL) JSON
- Render as a flowchart (using `react-flow` or `@xyflow/react`)
- Nodes: Task, Choice, Parallel, Wait, Pass, Succeed, Fail
- Edges between states following `Next` / `Default` / `Catch`

**Execution view:**
- Start execution with input JSON
- Watch each state light up in real-time as execution progresses
- Click any state to see its input/output
- View execution history

**Phase 10 Checklist**
- [ ] State machines list + create
- [ ] ASL JSON editor with schema validation
- [ ] Visual workflow renderer (react-flow)
- [ ] Start execution with input
- [ ] Real-time execution progress animation
- [ ] Execution history list
- [ ] Individual state input/output viewer

---

### Phase 11 — EventBridge

**Floci support:** Full (events + rules + scheduler)  
**Custom backend needed:** No  
**Estimated effort:** 3–4 days

**Pages:**
- `/eventbridge` — Event buses list
- `/eventbridge/rules` — Rules list + create rule
- `/eventbridge/scheduler` — Scheduled rules

**Rule creation:**
- Event source: AWS services (S3 PutObject, EC2 state change, etc.)
- Event pattern JSON editor
- Target: Lambda, SQS, SNS
- "Test with sample event" button

**Phase 11 Checklist**
- [ ] Event buses list (default + custom)
- [ ] Rules CRUD + event pattern editor
- [ ] Target configuration (Lambda/SQS/SNS)
- [ ] EventBridge Scheduler (cron + rate expressions)
- [ ] Test event sender

---

### Phase 12 — Secrets Manager + SSM Parameter Store

**Floci support:** Both fully supported  
**Custom backend needed:** No  
**Estimated effort:** 2–3 days

These two services are simple CRUD but important for real-world patterns (never hardcode credentials).

#### Secrets Manager
- `/secretsmanager` — Secrets list
- Create secret (Other → key/value or plain text; RDS credentials template)
- View/edit secret value, rotation settings (cosmetic)

#### SSM Parameter Store
- `/ssm/parameters` — Parameters list (String / SecureString / StringList)
- Create parameter with path hierarchy (e.g. `/myapp/prod/db-password`)
- View versions, compare values

**Phase 12 Checklist**
- [ ] Secrets list + create (key/value + plain text)
- [ ] View/edit secret value
- [ ] SSM parameters list + create (String / SecureString)
- [ ] Parameter path hierarchy browser
- [ ] Version history

---

### Phase 13 — Kinesis

**Floci support:** Full (Data Streams + Firehose)  
**Custom backend needed:** No  
**Estimated effort:** 3–4 days

**Pages:**
- `/kinesis/streams` — Data Streams list
- `/kinesis/stream/:name` — Stream detail
- `/kinesis/firehose` — Delivery streams list

**Stream detail:**
- Shard information, enhanced monitoring
- **Put records panel** — Learner can type/paste JSON records and push them to the stream
- **Consumer panel** — Poll shards and display records as they arrive (teaches real-time streaming concept)

**Phase 13 Checklist**
- [ ] Data Streams list + create (shard count)
- [ ] Put records panel (manual data ingestion)
- [ ] Consumer panel (shard iterator → GetRecords)
- [ ] Firehose delivery streams list + create

---

### Phase 14 — Cognito

**Floci support:** cognito-idp running  
**Custom backend needed:** Partial  
**Estimated effort:** 1 week

Teaching authentication concepts: user pools, sign-up flows, JWT tokens.

**Pages:**
- `/cognito` — User pools list
- `/cognito/create` — Create user pool (name, password policy, MFA, attributes)
- `/cognito/pool/:id` — Pool detail (Users, App clients, Triggers tabs)

**Users tab:**
- List users, create user (sets temp password)
- Confirm user, disable/enable user
- Add user to groups

**Auth flow simulation:**
- "Try the hosted UI" — opens a mock login page
- Learner can sign up, confirm, sign in → gets a JWT token
- Shows decoded token (header, payload, signature)

**Phase 14 Checklist**
- [ ] User pools list + create
- [ ] Pool settings (password policy, MFA options)
- [ ] Users CRUD (create, confirm, disable)
- [ ] App clients management
- [ ] Mock hosted UI (sign-up / sign-in flow)
- [ ] JWT token decoder/viewer

---

### Phase 15 — EKS

**Floci support:** API running (no real Kubernetes nodes)  
**Custom backend needed:** Yes (kind/k3s for real clusters)  
**Estimated effort:** 2 weeks  
**Priority:** Low — complexity is high, but it's a major AWS service

#### Our Approach

Floci's EKS API works but doesn't spin up real nodes. We use **k3d** (k3s in Docker) to create real lightweight Kubernetes clusters.

**When learner creates an EKS cluster:**
1. Floci creates the cluster record (cluster ARN, API endpoint, status)
2. Our backend runs: `k3d cluster create learner-cluster-name`
3. Returns a real kubeconfig
4. Learner downloads kubeconfig and uses `kubectl`

**Pages:**
- `/eks` — Clusters list
- `/eks/create` — Create cluster (name, Kubernetes version, role, networking)
- `/eks/cluster/:name` — Cluster detail (Overview, Node Groups, Workloads, Config tabs)

**Workloads tab:**
- Running pods list (real — from k3s cluster)
- Deployments, Services, ConfigMaps
- kubectl equivalent commands shown alongside each action

**Phase 15 Checklist**
- [ ] Clusters list + create
- [ ] Backend: k3d cluster creation/deletion
- [ ] Kubeconfig download
- [ ] Cluster detail: real node status
- [ ] Workloads tab: pods, deployments, services (real data from k3s)
- [ ] Node groups management (cosmetic)

---

### Phase 16 — RDS

**Floci support:** Partial (API works, no real database engine)  
**Custom backend needed:** Yes (real PostgreSQL/MySQL in Docker)  
**Estimated effort:** 1 week

**Our approach:** Each "RDS instance" = a real PostgreSQL or MySQL Docker container.

**Pages:**
- `/rds` — DB instances list (status: creating/available/stopped)
- `/rds/create` — Create DB instance wizard (engine, version, instance class, storage, credentials)
- `/rds/instance/:id` — Instance detail

**Instance detail:**
- **Connectivity** — Endpoint, port, VPC, security group
- **Configuration** — Engine version, instance class, storage
- **Query editor** — In-browser SQL editor connected to the real Docker PostgreSQL/MySQL
- **Logs** — Container logs

**Query editor:**
```sql
SELECT * FROM users LIMIT 10;
```
Real results from the Docker container. Learners learn SQL + RDS connection patterns together.

**Phase 16 Checklist**
- [ ] DB instances list + create wizard
- [ ] Backend: PostgreSQL + MySQL Docker containers
- [ ] Instance detail with real connectivity info
- [ ] In-browser query editor (real SQL against Docker container)
- [ ] Start/stop/delete instance lifecycle

---

### Phase 17 — CloudFormation

**Floci support:** Full  
**Custom backend needed:** No  
**Estimated effort:** 1 week

Teaching "infrastructure as code" — create entire AWS environments from YAML/JSON templates.

**Pages:**
- `/cloudformation` — Stacks list
- `/cloudformation/create` — Create stack wizard
- `/cloudformation/stack/:name` — Stack detail

**Create stack wizard:**
1. Template source (Upload, paste, or pick a sample)
2. Stack name + parameter overrides
3. Options (tags, rollback)
4. Review + Create

**Stack detail tabs:**
- **Events** — Real-time creation log (`CREATE_IN_PROGRESS` → `CREATE_COMPLETE`)
- **Resources** — List of created resources with links to their pages
- **Template** — View the deployed template
- **Parameters / Outputs**

**Sample templates library:**
- "S3 static website" — creates S3 bucket + bucket policy
- "Lambda + API Gateway" — creates a REST API + Lambda
- "DynamoDB + Lambda" — creates a DynamoDB table + Lambda with event trigger

**Phase 17 Checklist**
- [ ] Stacks list + create wizard
- [ ] Template upload + paste (YAML/JSON)
- [ ] Parameter inputs for parameterized templates
- [ ] Stack events real-time log
- [ ] Resources list with links
- [ ] Sample templates library (3–5 templates)
- [ ] Update stack
- [ ] Delete stack with rollback

---

### Phase 18 — Bedrock

**Floci support:** bedrock-runtime running  
**Custom backend needed:** No (but may need custom mock responses)  
**Estimated effort:** 3–4 days  
**Uniqueness:** Almost no other simulator covers this — huge differentiator

**Pages:**
- `/bedrock` — Model catalog
- `/bedrock/playground` — Model playground

**Model playground:**
- Select model (Claude, Titan, Llama, Mistral)
- Configure: max tokens, temperature, top-p
- Chat interface (streaming responses)
- Shows raw API request/response for educational value

Since Floci's bedrock-runtime may return mock responses, we can augment it with real model responses (optional, if we integrate a real AI provider key in the backend).

**Phase 18 Checklist**
- [ ] Model catalog page
- [ ] Playground with chat UI
- [ ] System prompt + conversation history
- [ ] Raw API request/response viewer
- [ ] API code snippets (Python + Node.js)

---

## Complete Service Catalog

| Service | Floci Support | Custom Backend | Priority | Phase |
|---|---|---|---|---|
| S3 | ✅ Full | No | 🔴 Critical | 1 |
| Lambda | ✅ Full API | Yes (execution) | 🔴 Critical | 2 |
| EC2 | ✅ Full API | Yes (Docker) | 🔴 Critical | 3 |
| DynamoDB | ✅ Full | No | 🔴 Critical | 4 |
| IAM | ✅ Full API | Yes (enforcement) | 🔴 Critical | 5 |
| SQS | ✅ Full | No | 🟠 High | 6 |
| SNS | ✅ Full | No | 🟠 High | 6 |
| API Gateway (v1+v2) | ✅ Full | Partial | 🟠 High | 7 |
| ECS | ✅ Full API | Yes (Docker) | 🟠 High | 8 |
| ECR | ✅ Full | No | 🟠 High | 8 |
| CloudWatch Logs | ✅ Full | No | 🟠 High | 9 |
| CloudWatch Metrics | 🟡 Partial | No | 🟡 Medium | 9 |
| StepFunctions | ✅ Full | No | 🟡 Medium | 10 |
| EventBridge | ✅ Full | No | 🟡 Medium | 11 |
| EventBridge Scheduler | ✅ Full | No | 🟡 Medium | 11 |
| Secrets Manager | ✅ Full | No | 🟡 Medium | 12 |
| SSM Parameter Store | ✅ Full | No | 🟡 Medium | 12 |
| Kinesis Data Streams | ✅ Full | No | 🟡 Medium | 13 |
| Kinesis Firehose | ✅ Full | No | 🟡 Medium | 13 |
| Cognito | 🟡 Partial | Partial | 🟡 Medium | 14 |
| EKS | 🟡 API only | Yes (k3d) | 🟢 Low | 15 |
| RDS | 🟡 Partial | Yes (Docker DB) | 🟢 Low | 16 |
| CloudFormation | ✅ Full | No | 🟡 Medium | 17 |
| Bedrock | 🟡 Partial | Optional | 🟡 Medium | 18 |
| Athena | 🟡 Partial | No | 🟢 Low | 19 |
| Glue | 🟡 Partial | No | 🟢 Low | 19 |
| ElastiCache | 🟡 Partial | Yes (Docker Redis) | 🟢 Low | 20 |
| KMS | ✅ Full | No | 🟢 Low | 21 |
| ACM | ✅ Full | No | 🟢 Low | 21 |
| Route 53 | ✅ Full | No | 🟢 Low | 21 |
| ELB / ALB | ✅ Full API | Yes (Docker) | 🟢 Low | 22 |
| Auto Scaling | ✅ Full API | Yes (Docker) | 🟢 Low | 22 |
| CodeBuild | ✅ Full API | Yes (Docker) | 🟢 Low | 23 |
| CodeDeploy | ✅ Full API | No | 🟢 Low | 23 |
| SES | ✅ Full | No | 🟢 Low | 24 |
| MSK (Kafka) | ✅ Full | No | 🟢 Low | 24 |
| OpenSearch | 🟡 Partial | No | 🟢 Low | 24 |
| AWS Backup | ✅ Full | No | 🟢 Low | 25 |
| Transcribe | 🟡 Partial | No | 🟢 Low | 25 |
| Textract | 🟡 Partial | No | 🟢 Low | 25 |
| Cost Explorer | 🟡 Partial | No | 🟢 Low | 25 |
| AppConfig | ✅ Full | No | 🟢 Low | 25 |
| Pipes | ✅ Full | No | 🟢 Low | 25 |
| Transfer Family | ✅ Full | No | 🟢 Low | 25 |

---

## File Structure (Final)

```
aws-simulator/
├── aws-console-clone/            ← React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── aws-client.js
│   │   ├── index.css
│   │   ├── context/
│   │   │   ├── RegionContext.jsx  ← current region, current IAM user
│   │   │   └── ToastContext.jsx   ← global toast notifications
│   │   ├── components/
│   │   │   ├── AwsLayout.jsx
│   │   │   ├── ServiceIcons.jsx
│   │   │   └── shared/
│   │   │       ├── CopyButton.jsx
│   │   │       ├── ConfirmModal.jsx
│   │   │       └── Toast.jsx
│   │   └── pages/
│   │       ├── ConsoleHome.jsx
│   │       ├── s3/
│   │       ├── lambda/
│   │       ├── ec2/
│   │       ├── dynamodb/
│   │       ├── iam/
│   │       ├── sqs/
│   │       ├── sns/
│   │       ├── apigateway/
│   │       ├── ecs/
│   │       ├── ecr/
│   │       ├── cloudwatch/
│   │       ├── stepfunctions/
│   │       └── ...
│   ├── vite.config.js
│   └── package.json
│
├── backend/                      ← Custom Node.js backend
│   ├── server.js                 ← Express entry point
│   ├── lambda-runner.js          ← Code execution sandbox
│   ├── ec2-manager.js            ← Docker container lifecycle
│   ├── iam-enforcer.js           ← IAM policy evaluation
│   ├── terminal-server.js        ← WebSocket ↔ container bridge
│   ├── iam.db                    ← SQLite (IAM entities)
│   ├── state.db                  ← SQLite (EC2 containers, Lambda logs)
│   └── package.json
│
├── nginx.conf                    ← Production reverse proxy config
├── docker-compose.yml            ← Full stack orchestration
├── scripts/
│   ├── cleanup.cron              ← Daily 9 AM reset
│   └── deploy.sh                 ← EC2 deployment script
│
└── PLAN.md                       ← This document
```

---

## Learning Transfer Summary

The single most important design principle: **all code written here works on real AWS with one change.**

| Simulator | Real AWS |
|---|---|
| `boto3.client('s3', endpoint_url='http://your-ec2-ip')` | `boto3.client('s3')` |
| `aws --endpoint-url http://your-ec2-ip s3 ls` | `aws s3 ls` |
| `ssh -i key.pem ec2-user@<container-ip>` | `ssh -i key.pem ec2-user@<ec2-ip>` |
| Write Lambda handler with `event`, `context` | Identical |
| DynamoDB `put_item`, `query`, `scan` | Identical |
| CloudFormation YAML templates | Identical |
| IAM policy JSON documents | Identical |

---

*Last updated: May 2026 — 47 services confirmed running on Floci*
