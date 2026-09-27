# Instant Research & Study Assistant

Turn lecture notes, research abstracts, code, Word documents, and text-based PDFs into a focused study guide with:

- One core thesis or concept
- Key technical takeaways
- Three quick review questions

## Why This Architecture

This project intentionally uses exactly three AWS services:

1. **AWS Amplify Hosting** serves the static frontend.
2. **AWS Lambda** receives the request through a Lambda Function URL.
3. **Amazon Bedrock** uses Amazon Nova Lite to generate the study guide.

There is no API Gateway, S3 bucket, database, authentication service, or frontend framework. Documents are parsed locally in the browser. Only extracted text is sent to Lambda.

## Before You Start

You need:

- An AWS account and an AWS region where Amazon Nova Lite is available
- A GitHub account and repository access
- AWS Bedrock model access enabled for `amazon.nova-lite-v1:0`
- The files in this repository

Choose one AWS region and use it consistently for Bedrock and Lambda. Model availability and pricing vary by region.

## Step 1: Create the Lambda Function

1. Open the AWS Lambda console.
2. Choose **Create function** and select **Author from scratch**.
3. Set the function name to `study-signal`.
4. Select runtime **Python 3.12**.
5. Create a new execution role with basic Lambda permissions.
6. Open **Configuration > General configuration** and set memory to `256 MB` and timeout to `30 seconds`.
7. Open **Configuration > Environment variables** and add `BEDROCK_MODEL_ID` with value `amazon.nova-lite-v1:0`.
8. Open the **Code** tab and replace the default file with [`lambda_function.py`](lambda_function.py).
9. Set the handler to `lambda_function.lambda_handler` if the console shows a different handler.
10. Choose **Deploy**.

The handler accepts `POST {"text":"..."}`, limits input to 20,000 characters, invokes Bedrock, and returns structured JSON with CORS headers.

## Step 2: Give Lambda the Minimum Permissions

Open the Lambda function's **Configuration > Permissions** page. Open the execution role in IAM, choose **Add permissions > Create inline policy**, select the JSON editor, and paste the contents of [`iam-policy.json`](iam-policy.json).

The policy allows only `bedrock:InvokeModel` for the Amazon Nova Lite foundation model and basic CloudWatch Logs actions. Save the policy and return to Lambda. Do not add administrator permissions to the Lambda role.

## Step 3: Enable Bedrock Model Access

1. Open the Amazon Bedrock console in the same region as the Lambda function.
2. Open **Model access**.
3. Request or enable access to Amazon Nova Lite.
4. Wait until access is granted before testing Lambda.

If Bedrock returns an access or model-not-found error, check the region and model access first.

## Step 4: Create the Lambda Function URL

1. In Lambda, open **Configuration > Function URL**.
2. Choose **Create function URL**.
3. Set **Auth type** to `NONE` for this browser-only demo.
4. Configure CORS with allowed origin `*` during initial testing, allowed methods `POST` and `OPTIONS`, and allowed header `Content-Type`.
5. Create the URL and copy the generated endpoint.

The URL is public when auth is `NONE`. Input limits do not prevent abuse by themselves. Restrict the origin, monitor costs, and disable the URL when you are not testing.

## Step 5: Connect the Frontend to Lambda

Open [`app.js`](app.js) and replace:

```javascript
const FUNCTION_URL = "REPLACE_WITH_LAMBDA_FUNCTION_URL";
```

with the Function URL copied from AWS. Keep the URL in the frontend only; never put AWS access keys in this file.

### Fix: `FunctionURLAllowInvokeAction` Already Exists

If AWS shows:

```text
The statement id (FunctionURLAllowInvokeAction) provided already exists.
```

the Lambda Function URL permission already exists. Do not create another Function URL. Update the existing one instead:

1. Open Lambda > `study-signal` > **Configuration > Function URL**.
2. Confirm a Function URL is already listed. Use the **Edit** button for that listed URL; do not choose **Create function URL** again.
3. Set CORS to:
   - Allowed origin: `*` for initial testing, or your exact Amplify URL
   - Allowed methods: `POST` and `OPTIONS`
   - Allowed headers: `Content-Type`
4. Save the configuration.

The `OPTIONS` method matters because browser requests using `Content-Type: application/json` can send a CORS preflight request before the `POST`.

You can make the same update with AWS CLI by saving this as `cors.json`:

```json
{
  "AllowOrigins": ["*"],
  "AllowMethods": ["POST", "OPTIONS"],
  "AllowHeaders": ["Content-Type"],
  "MaxAge": 86400
}
```

Then run this in the same region as the function:

```powershell
aws lambda update-function-url-config `
  --function-name study-signal `
  --auth-type NONE `
  --cors file://cors.json `
  --region YOUR_REGION
```

Only if **Function URL** shows that no URL exists but the duplicate statement error remains, inspect the resource policy:

```powershell
aws lambda get-policy --function-name study-signal --region YOUR_REGION
```

If the policy contains the orphaned statement ID `FunctionURLAllowInvokeAction`, remove only that statement and create the Function URL once:

```powershell
aws lambda remove-permission `
  --function-name study-signal `
  --statement-id FunctionURLAllowInvokeAction `
  --region YOUR_REGION
```

Do not remove this permission when an existing Function URL is working; update its CORS settings instead.

## Step 6: Understand Document Uploads

The upload control supports `.txt`, `.md`, `.csv`, `.json`, `.docx`, and text-based `.pdf` files. PDF.js and Mammoth are loaded from public CDNs by [`index.html`](index.html).

The browser extracts text locally, caps it at 20,000 characters, and sends only that text to Lambda. Files are not stored in AWS. Scanned or image-only PDFs will not produce useful text because this project does not include OCR. Large files are limited to 10 MB before extraction.

## Step 7: Test the Backend

Use a small request first. Replace the URL below with your Function URL:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR_FUNCTION_ID.lambda-url.YOUR_REGION.on.aws/" `
  -ContentType "application/json" `
  -Body '{"text":"A cache stores frequently used data closer to the application to reduce latency, at the cost of invalidation complexity."}'
```

A successful response looks like:

```json
{
  "analysis": {
    "core_thesis": "...",
    "key_technical_takeaways": ["..."],
    "study_questions": ["...", "...", "..."]
  }
}
```

If the request fails, check CloudWatch logs for the function and verify Bedrock model access, the model ID, the region, and the Lambda execution role.

## Step 8: Push to GitHub

This project is published at [github.com/shatteredcode69/instant-community-study-research-assistant](https://github.com/shatteredcode69/instant-community-study-research-assistant).

For a new copy of the project:

```powershell
git init
git add .
git commit -m "Initial study assistant"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

The included `.gitignore` prevents common Python caches, virtual environments, AWS folders, and `.env` files from being committed. Always inspect files before pushing.

## Step 9: Deploy the Frontend with Amplify

1. Open the AWS Amplify console and choose **Host web app**.
2. Select GitHub and authorize AWS Amplify.
3. Select the repository and branch.
4. Use the repository root as the app root.
5. Because this is static HTML, use no build command and deploy the repository files directly.
6. If Amplify asks for a build specification, use:

```yaml
version: 1
frontend:
  phases:
    build:
      commands: []
  artifacts:
    baseDirectory: /
    files:
      - '**/*'
  cache:
    paths: []
```

7. Deploy and open the Amplify URL.
8. Paste a short abstract, choose **Build study guide**, and test a small upload.
9. After the Amplify URL works, replace the Function URL CORS origin `*` with the exact Amplify domain.

Keep `Access-Control-Allow-Origin` in the Lambda response aligned with that domain for a tighter production configuration.

## Local Preview

Open [`index.html`](index.html) directly or serve the directory with a static server. The page will show an endpoint error until `FUNCTION_URL` in [`app.js`](app.js) is configured.

## Cost Precautions

Bedrock charges for input and output tokens. A public Lambda Function URL can also be abused, so treat this as a guarded demo rather than an open public service.

- Start with short abstracts or small code excerpts.
- Keep the 20,000-character input cap and 900-token output cap.
- Do not add automatic retries, polling, streaming, or analysis on every keystroke.
- Create an AWS Budget alert with a small monthly amount before sharing the app.
- A Budget alert notifies you; it is not a guaranteed hard cutoff.
- Check current Bedrock pricing and free-tier terms for your region.
- Use a restricted Amplify origin instead of `*` after initial testing.
- Disable or delete the Lambda Function URL when the experiment is over.
- Never commit AWS keys, tokens, or credentials to GitHub.
- Monitor CloudWatch logs and Bedrock usage while testing.

For real public use, add authentication and abuse controls. Those require additional architecture beyond this intentionally constrained three-service version.