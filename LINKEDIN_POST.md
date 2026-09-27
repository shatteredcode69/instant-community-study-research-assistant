# LinkedIn Post

I built **Instant Research & Study Assistant**, a lightweight tool that turns lecture notes, research abstracts, code snippets, Word documents, and text-based PDFs into a focused study guide.

It returns:

- The core thesis or concept
- Key technical takeaways
- Three quick review questions

What makes it different from many AI study tools?

It is intentionally small and transparent.

The entire AWS architecture uses only three services:

1. AWS Amplify for the frontend
2. AWS Lambda with a Function URL for the backend
3. Amazon Bedrock with Amazon Nova Lite for analysis

There is no API Gateway, no S3 document bucket, no database, and no framework-heavy application layer.

Documents are parsed locally in the browser. The app sends only capped extracted text to Lambda, which keeps the flow easy to understand and avoids storing uploaded files by default.

I also added practical guardrails for a small personal project: input and output limits, no automatic retries, browser-side file handling, and guidance for AWS Budget alerts.

The goal was not to build another giant workspace with dozens of features. It was to build something a student or developer can understand, deploy, inspect, and improve in under an hour.

Repository: https://github.com/shatteredcode69/instant-community-study-research-assistant

#AWS #Serverless #AmazonBedrock #AWSLambda #AWSAmplify #Python #WebDevelopment #AI #DeveloperTools #StudyTools