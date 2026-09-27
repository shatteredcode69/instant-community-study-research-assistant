"""Lambda Function URL handler for the Study Signal assistant."""

import base64
import json
import logging
import os
from typing import Any

import boto3

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
MAX_INPUT_CHARACTERS = 20_000
bedrock_runtime = boto3.client("bedrock-runtime")


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Validate a Function URL request, invoke Bedrock, and return JSON."""
    try:
        request = parse_request_body(event)
        source_text = request.get("text")
        if not isinstance(source_text, str) or not source_text.strip():
            return response(400, {"error": "Request body must include non-empty string field 'text'."})
        if len(source_text) > MAX_INPUT_CHARACTERS:
            return response(413, {"error": f"Text must be {MAX_INPUT_CHARACTERS:,} characters or fewer."})

        analysis = invoke_bedrock(source_text.strip())
        return response(200, {"analysis": analysis})
    except (json.JSONDecodeError, TypeError, ValueError) as error:
        LOGGER.info("Invalid request: %s", error)
        return response(400, {"error": "Request body must be valid JSON."})
    except Exception:
        LOGGER.exception("Study guide generation failed")
        return response(500, {"error": "The study guide could not be generated."})


def parse_request_body(event: dict[str, Any]) -> dict[str, Any]:
    body = event.get("body", "")
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    if isinstance(body, dict):
        return body
    if not isinstance(body, str):
        raise TypeError("body must be a JSON string")
    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise TypeError("JSON body must be an object")
    return parsed


def invoke_bedrock(source_text: str) -> dict[str, Any]:
    prompt = f"""You are a precise study and software architecture assistant. Analyze the source material below.

Return ONLY valid JSON with exactly these keys:
{{
  "core_thesis": "one concise paragraph explaining the central concept",
  "key_technical_takeaways": ["3 to 6 concrete takeaways"],
  "study_questions": ["exactly 3 quick review questions"]
}}

Keep the answer grounded in the source. For code, call out important architectural decisions, tradeoffs, or failure modes. Do not invent facts.

SOURCE MATERIAL:
{source_text}"""
    request_body = {
        "schemaVersion": "messages-v1",
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "inferenceConfig": {"max_new_tokens": 900, "temperature": 0.2},
    }
    result = bedrock_runtime.invoke_model(modelId=BEDROCK_MODEL_ID, body=json.dumps(request_body))
    model_body = json.loads(result["body"].read())
    model_text = model_body["output"]["message"]["content"][0]["text"]
    return parse_model_json(model_text)


def parse_model_json(model_text: str) -> dict[str, Any]:
    cleaned = model_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("Bedrock returned a non-object JSON value")
    return parsed


def response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }