# Instant Research & Study Assistant

A deliberately small three-service app: AWS Amplify hosts the static page, an AWS Lambda Function URL receives the request, and Amazon Bedrock (Claude 3 Haiku) creates the study guide. There is no API Gateway, S3 bucket, database, or framework dependency.

The upload control reads `.txt`, `.md`, `.csv`, `.json`, `.docx`, and text-based `.pdf` files locally in the browser using CDN-loaded PDF.js and Mammoth. It does not upload a file to AWS: only the extracted, capped text is sent to Lambda. Scanned/image-only PDFs need OCR, which is intentionally not included.

## 1. Create the Lambda

1. In AWS Lambda, choose **Create function**, select **Author from scratch**, runtime **Python 3.12**, and name it `study-signal`.
2. In **Configuration > Permissions**, open the execution role and add the statements in [`iam-policy.json`](iam-policy.json) as an inline policy. The policy grants only model invocation and basic CloudWatch Logs access.
3. In **Configuration > General configuration**, set a timeout of 30 seconds and memory of 256 MB.
4. In **Configuration > Environment variables**, optionally set `BEDROCK_MODEL_ID` to `anthropic.claude-3-haiku-20240307-v1:0`.
5. In **Code**, replace the default file with [`lambda_function.py`](lambda_function.py), then **Deploy**. Set the handler to `lambda_function.lambda_handler` if needed.
6. Ensure the Claude 3 Haiku model is enabled in the same AWS region under the Amazon Bedrock model access page. Availability varies by region.

## 2. Create the Lambda Function URL

1. Open **Configuration > Function URL > Create function URL**.
2. Set **Auth type** to `NONE`. Confirm the public-access warning. The endpoint is protected by input limits and does not accept AWS credentials from the browser.
3. Configure CORS with allowed origin `*` for a quick demo, allowed methods `POST` (the handler also answers `OPTIONS`), and allowed headers `Content-Type`. For production, replace `*` with the exact Amplify domain.
4. Copy the generated Function URL into `FUNCTION_URL` in [`app.js`](app.js). Keep the trailing slash exactly as AWS provides it.

The Lambda handler returns standard CORS headers on success and errors. Its expected request is `POST {"text":"..."}` and its response is `{ "analysis": { "core_thesis": ..., "key_technical_takeaways": [...], "study_questions": [...] } }`.

## 3. Deploy with Amplify Hosting

The easiest path is Git-based Amplify Hosting:

1. Put this folder in a GitHub, GitLab, Bitbucket, or CodeCommit repository.
2. In AWS Amplify, choose **Host web app**, select the Git provider, authorize it, and choose the repository and branch.
3. When prompted for build settings, use the repository root as the app root. No build command or output directory is required because this is static HTML. If Amplify requires a build specification, use:

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

4. Save and deploy. Open the Amplify URL and submit a small test abstract.
5. After confirming the endpoint works, change Lambda CORS allowed origin from `*` to the Amplify domain and update the handler's `Access-Control-Allow-Origin` value to the same origin.

## Local check

Open `index.html` directly for the layout, or serve the folder with any static file server. The page will intentionally show an error until `FUNCTION_URL` in `app.js` has been replaced. No AWS credentials belong in the frontend.

## Cost and production notes

Bedrock charges per input and output token. To avoid burning free credits on experiments:

- Keep the 20,000-character input cap and 900-token output cap. Do not raise them casually.
- Test with short abstracts or small code excerpts first; long documents multiply input-token cost.
- Do not add automatic retries, polling, streaming, or analysis on every keystroke. This app calls Bedrock only after the button is pressed.
- Set an AWS Budgets alert and a small monthly cost budget before sharing the URL. Budgets alerts notify you; they are not a hard usage cutoff.
- Check the Bedrock pricing page for your region and model before inviting others. Free-tier eligibility and limits can change.
- Keep the Function URL private during testing or restrict CORS to your Amplify domain. A public unauthenticated URL can be abused and incur charges.
- Delete or disable the Lambda Function URL when you are done experimenting, and remove the Amplify app if it is no longer needed.
- Never put AWS keys in `app.js`, commit them to GitHub, or paste them into the browser. The Lambda execution role is the only place that needs AWS permissions.

For a public launch, add authentication or a separate abuse-control service, but that would exceed this project's strict three-service constraint.