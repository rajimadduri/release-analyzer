"""
Release Intelligence Dashboard - FastAPI Backend
Claude API integration for release risk analysis
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from anthropic import Anthropic
import json
import re
import httpx
import base64

load_dotenv()

DEMO_KEY_VALUES = {"demo", "sk-ant-demo", "sk-ant-DEMO", "sk-ant-YOUR_KEY_HERE"}


def _env_flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "").strip()
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6").strip()
DEMO_MODE = _env_flag("DEMO_MODE") or CLAUDE_API_KEY.lower() in DEMO_KEY_VALUES
DEMO_FALLBACK = _env_flag("DEMO_FALLBACK")

JIRA_EMAIL = os.getenv("JIRA_EMAIL", "").strip()
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "").strip()
JIRA_BASE_URL = os.getenv("JIRA_BASE_URL", "").strip()

if DEMO_MODE or not CLAUDE_API_KEY:
    client = None
else:
    client = Anthropic(api_key=CLAUDE_API_KEY)

app = FastAPI(
    title="Release Intelligence Dashboard",
    description="AI-powered release management with Claude API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://release-analyzer.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReleaseAnalysisRequest(BaseModel):
    release_notes: str
    test_coverage: float
    dependencies_changed: int
    deployment_window: str = "standard"


class RiskAnalysis(BaseModel):
    risk_score: float
    risk_factors: list[str]
    recommendations: list[str]
    confidence: float

class JiraReleaseRequest(BaseModel):
    version_name: str
    project_key: str = "RAD"
    test_coverage: float = 80.0
    dependency_label: str = "dependency"
    deployment_window: str = "standard"

class RunbookGenerationRequest(BaseModel):
    release_notes: str
    risk_analysis: RiskAnalysis
    deployment_procedure: str = ""


class GeneratedRunbook(BaseModel):
    title: str
    prerequisites: list[str]
    deployment_steps: list[str]
    monitoring: list[str]
    rollback_procedure: list[str]
    post_deployment_checks: list[str]


def demo_risk_analysis(
    release_notes: str,
    test_coverage: float,
    dependencies_changed: int,
) -> RiskAnalysis:
    """Deterministic sample analysis for interviews when Claude API is unavailable."""
    notes_lower = release_notes.lower()
    score = 1.5

    if any(word in notes_lower for word in ("cve", "security", "hotfix", "critical")):
        score += 0.8
    if any(word in notes_lower for word in ("migration", "database", "rollback", "outage")):
        score += 0.7
    if test_coverage < 70:
        score += 0.8
    elif test_coverage < 85:
        score += 0.3
    if dependencies_changed >= 10:
        score += 0.8
    elif dependencies_changed >= 5:
        score += 0.4

    score = round(min(max(score, 0.5), 4.2), 1)
    confidence = 0.82 if test_coverage >= 80 else 0.68

    risk_factors = []
    recommendations = []

    if "cve" in notes_lower or "security" in notes_lower:
        risk_factors.append("Security-related changes require validated patch verification and rollback planning.")
        recommendations.append("Run security regression tests and confirm CVE fixes against vendor advisories before deploy.")
    if dependencies_changed >= 5:
        risk_factors.append(f"{dependencies_changed} dependency updates increase compatibility and supply-chain risk.")
        recommendations.append("Review dependency changelogs and run integration tests focused on upgraded libraries.")
    if test_coverage < 85:
        risk_factors.append(f"Test coverage at {test_coverage:.0f}% leaves gaps in changed code paths.")
        recommendations.append("Add targeted tests for modified modules before production deployment.")
    if "tls" in notes_lower or "java" in notes_lower:
        risk_factors.append("Platform/runtime changes can affect connectivity and performance in edge environments.")
        recommendations.append("Validate TLS and JVM behavior in staging with production-like traffic patterns.")

    if not risk_factors:
        risk_factors = [
            "Moderate release scope with routine operational risk.",
            "Standard deployment checks still apply for production traffic.",
        ]
    if not recommendations:
        recommendations = [
            "Deploy during a standard maintenance window with on-call coverage.",
            "Monitor error rates and latency for 30 minutes post-release.",
        ]

    return RiskAnalysis(
        risk_score=score,
        risk_factors=risk_factors[:4],
        recommendations=recommendations[:4],
        confidence=confidence,
    )


def demo_runbook(release_notes: str, risk_analysis: RiskAnalysis) -> GeneratedRunbook:
    return GeneratedRunbook(
        title="Demo Release Deployment Runbook",
        prerequisites=[
            "Confirm staging sign-off and change ticket approval",
            "Verify rollback artifact is available",
            "Ensure on-call engineer is available",
        ],
        deployment_steps=[
            "Notify stakeholders of deployment start",
            "Deploy to canary environment and run smoke tests",
            "Roll out to 25%, then 50%, then 100% of production traffic",
            "Validate core user flows and API health endpoints",
        ],
        monitoring=[
            "Watch error rate, p95 latency, and 5xx responses",
            "Monitor auth failures and payment/webhook retries",
            "Review application logs for new exceptions",
        ],
        rollback_procedure=[
            "Stop progressive rollout",
            "Revert to previous stable release artifact",
            "Confirm health checks pass after rollback",
        ],
        post_deployment_checks=[
            "Run automated regression suite",
            "Validate dashboards and alerts are green for 30 minutes",
            "Document release outcome in change ticket",
        ],
    )


def _require_client() -> Anthropic:
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="CLAUDE_API_KEY is not set. Add your key to backend/.env "
            "(https://console.anthropic.com).",
        )
    return client

async def fetch_jira_issues(project_key: str, version_name: str, dependency_label: str = "dependency") -> tuple[str, int]:
    if not JIRA_EMAIL or not JIRA_API_TOKEN:
        raise HTTPException(status_code=503, detail="Jira credentials not configured.")
    
    token = base64.b64encode(f"{JIRA_EMAIL}:{JIRA_API_TOKEN}".encode()).decode()
    headers = {
        "Authorization": f"Basic {token}",
        "Accept": "application/json"
    }
    jql = f"project={project_key} AND fixVersion='{version_name}'"
    url = f"{JIRA_BASE_URL}/rest/api/3/search/jql?jql={jql}&fields=summary,issuetype,labels,fixVersions"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Jira API error: {response.text}")
        data = response.json()
    
    issues = data.get("issues", [])
    if not issues:
        raise HTTPException(status_code=404, detail=f"No issues found for version '{version_name}'")
    
    # Auto-count dependency issues from Jira labels
    dep_count = sum(1 for issue in issues
        if dependency_label.lower() in [l.lower() for l in issue.get("fields", {}).get("labels", [])])
    
    issues_text = ""
    for issue in issues:
        fields = issue.get("fields", {})
        key = issue.get("key", "")
        summary = fields.get("summary", "")
        issue_type = fields.get("issuetype", {}).get("name", "Task")
        labels = ", ".join(fields.get("labels", [])) or "none"
        issues_text += f"- [{issue_type}] {key}: {summary} (labels: {labels})\n"
    
    return issues_text, dep_count

def analyze_release_with_claude(
    release_notes: str,
    test_coverage: float,
    dependencies_changed: int,
) -> RiskAnalysis:
    if DEMO_MODE:
        return demo_risk_analysis(release_notes, test_coverage, dependencies_changed)

    system_prompt = """You are an expert release engineer with 20+ years of experience assessing deployment risk for large-scale systems. You have managed hundreds of releases for platforms serving millions of users.

Your task is to analyze releases and predict deployment risk. Respond ONLY with valid JSON (no markdown, no explanation, no code blocks)."""

    user_prompt = f"""Analyze this release for deployment risk:

Release Notes:
{release_notes}

Test Coverage: {test_coverage}%
Dependencies Changed: {dependencies_changed}

Return ONLY valid JSON (no markdown formatting):
{{
  "risk_score": <number 0.0-5.0>,
  "risk_factors": [<list of specific risk factors>],
  "recommendations": [<list of mitigation actions>],
  "confidence": <number 0.0-1.0>
}}

Risk scoring guidelines:
- 0.0-1.0: Very safe (minimal changes, excellent coverage, no critical updates)
- 1.0-2.0: Safe (minor changes, good coverage, routine dependency updates)
- 2.0-3.0: Moderate (some unknowns, security patches, new platforms, coverage gaps)
- 3.0-4.0: High risk (significant changes, low coverage, critical updates, limited testing)
- 4.0-5.0: Do not ship (major issues, security gaps, untested critical paths)

Be specific in risk factors and recommendations. Ground them in the actual release details provided."""

    try:
        response = _require_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        response_text = response.content[0].text.strip()

        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                raise ValueError(f"Could not extract JSON from: {response_text}")

        required_fields = ["risk_score", "risk_factors", "recommendations", "confidence"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        return RiskAnalysis(**data)

    except HTTPException:
        raise
    except Exception as e:
        if DEMO_FALLBACK:
            return demo_risk_analysis(release_notes, test_coverage, dependencies_changed)
        raise ValueError(f"Claude API error: {str(e)}")


def generate_runbook_with_claude(
    release_notes: str,
    risk_analysis: RiskAnalysis,
    deployment_procedure: str,
) -> GeneratedRunbook:
    if DEMO_MODE:
        return demo_runbook(release_notes, risk_analysis)

    system_prompt = """You are an expert operations engineer. Create detailed, actionable runbooks that ops teams can follow step-by-step. Be specific with commands where applicable.

Respond ONLY with valid JSON (no markdown, no explanation)."""

    user_prompt = f"""Generate an operations runbook for this release:

Release Notes:
{release_notes}

Risk Analysis:
- Risk Score: {risk_analysis.risk_score}/5
- Risk Factors: {', '.join(risk_analysis.risk_factors)}
- Recommendations: {', '.join(risk_analysis.recommendations)}

Current Deployment Procedure:
{deployment_procedure if deployment_procedure else "Standard deployment process"}

Return ONLY valid JSON:
{{
  "title": "<runbook title>",
  "prerequisites": [<checklist items before deployment>],
  "deployment_steps": [<numbered steps with specific commands/actions>],
  "monitoring": [<specific metrics, alerts, logs to watch>],
  "rollback_procedure": [<steps to rollback with specific commands>],
  "post_deployment_checks": [<validation steps>]
}}

Be specific. Include actual commands where applicable (e.g., "kubectl rollout status", "curl health-check-endpoint"). Be conservative with risk assessments."""

    try:
        response = _require_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        response_text = response.content[0].text.strip()

        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                raise ValueError(f"Could not extract JSON from: {response_text}")

        return GeneratedRunbook(**data)

    except HTTPException:
        raise
    except Exception as e:
        if DEMO_FALLBACK:
            return demo_runbook(release_notes, risk_analysis)
        raise ValueError(f"Claude API error: {str(e)}")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "claude_configured": client is not None,
        "demo_mode": DEMO_MODE,
        "demo_fallback": DEMO_FALLBACK,
    }


@app.post("/api/analysis/analyze")
async def analyze_release(request: ReleaseAnalysisRequest):
    try:
        if not request.release_notes.strip():
            raise ValueError("Release notes cannot be empty")

        if not 0 <= request.test_coverage <= 100:
            raise ValueError("Test coverage must be 0-100")

        if request.dependencies_changed < 0:
            raise ValueError("Dependencies changed must be >= 0")

        analysis = analyze_release_with_claude(
            release_notes=request.release_notes,
            test_coverage=request.test_coverage,
            dependencies_changed=request.dependencies_changed,
        )

        return {
            "success": True,
            "data": analysis.model_dump(),
            "demo_mode": DEMO_MODE,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/analysis/runbook")
async def generate_runbook(request: RunbookGenerationRequest):
    try:
        if not request.release_notes.strip():
            raise ValueError("Release notes cannot be empty")

        runbook = generate_runbook_with_claude(
            release_notes=request.release_notes,
            risk_analysis=request.risk_analysis,
            deployment_procedure=request.deployment_procedure,
        )

        return {
            "success": True,
            "data": runbook.model_dump(),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Runbook generation failed: {str(e)}")

@app.post("/api/analysis/analyze-jira")
async def analyze_jira_release(request: JiraReleaseRequest):
    try:
        issues_text, dep_count = await fetch_jira_issues(
            request.project_key, request.version_name, request.dependency_label
        )
        
        prompt = f"""Here are the Jira issues for version '{request.version_name}':

{issues_text}

Test Coverage: {request.test_coverage}%
Dependencies Changed: {dep_count} (auto-counted from Jira issues labeled '{request.dependency_label}')

First summarize these issues as release notes, then assess the release risk.

Return ONLY valid JSON:
{{
  "release_notes_summary": "<2-3 sentence summary of what this release contains>",
  "risk_score": <number 0.0-5.0>,
  "risk_factors": [<list of specific risk factors>],
  "recommendations": [<list of mitigation actions>],
  "confidence": <number 0.0-1.0>
}}"""

        if DEMO_MODE:
            analysis = demo_risk_analysis(issues_text, request.test_coverage, len(issues_text.split("\n")))
            return {"success": True, "data": analysis.model_dump(), "issues_fetched": issues_text, "demo_mode": True}

        response = _require_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            system="You are an expert release engineer. Analyze Jira issues and assess deployment risk. Respond ONLY with valid JSON.",
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.content[0].text.strip()
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                raise ValueError(f"Could not extract JSON from: {response_text}")

        return {"success": True, "data": data, "issues_fetched": issues_text, "demo_mode": False}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Jira analysis failed: {str(e)}")
        

@app.get("/api/metrics/summary")
async def get_metrics_summary():
    return {
        "cycle_time_weeks": 6.2,
        "on_time_rate": 0.94,
        "rollback_rate": 0.003,
        "avg_risk_score": 2.3,
        "releases_this_month": 8,
    }


if __name__ == "__main__":
    import uvicorn

    print("Starting Release Intelligence Dashboard")
    print("http://localhost:8000")
    print("API Docs: http://localhost:8000/docs")
    print(f"Claude API configured: {client is not None}")
    print(f"Demo mode: {DEMO_MODE}")
    print(f"Demo fallback on API errors: {DEMO_FALLBACK}")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "False").lower() == "true",
    )
