/**
 * ProfileExtractorService — AI-powered extraction of structured profile data
 * Uses Gemini to parse CV text into structured UserProfile fields
 * and job descriptions into CompanyContext fields
 */
import https from "https";
import { createScopedLogger } from "../logger";

const logger = createScopedLogger("profile-extractor");

const API_HOST = "generativelanguage.googleapis.com";
const MODEL = "gemini-2.0-flash";

interface ExtractedProfile {
    name?: string;
    targetRole?: string;
    yearsExperience?: number;
    skills: string[];
    achievements?: string;
    education?: { degree: string; institution: string; year?: number }[];
    workHistory?: { title: string; company: string; duration: string; highlights: string[] }[];
    projects?: { name: string; description: string; tech: string[] }[];
    certifications?: string[];
    languages?: { name: string; level: string }[];
    aiSummary?: string;
}

interface ExtractedCompany {
    companyName: string;
    jobTitle?: string;
    requiredSkills?: string[];
    niceToHaveSkills?: string[];
    responsibilities?: string[];
    companyValues?: string[];
    interviewFocus?: string;
    techStack?: string[];
}

interface CompanyResearch {
    companyInfo: string;
    techStack?: string[];
    companyValues?: string[];
    talkingPoints?: string[];
}

async function callGemini(apiKey: string, prompt: string, content: string): Promise<string> {
    const path = `/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\n---\n\n${content}` }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
        }
    });

    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: API_HOST,
                path,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                timeout: 30_000
            },
            (res) => {
                let data = "";
                res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
                res.on("end", () => {
                    // Check HTTP status code first
                    if (res.statusCode && res.statusCode !== 200) {
                        const errMsg = `Gemini API error ${res.statusCode}: ${data.slice(0, 300)}`;
                        logger.error(errMsg);
                        reject(new Error(errMsg));
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (!text) {
                            reject(new Error("Empty AI response"));
                            return;
                        }
                        resolve(text);
                    } catch (err) {
                        reject(new Error(`Failed to parse AI response: ${err}`));
                    }
                });
            }
        );
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Gemini API request timed out (30s)"));
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

/**
 * Extract structured profile data from CV/resume text
 */
export async function extractProfileFromText(
    apiKey: string,
    text: string
): Promise<ExtractedProfile> {
    logger.info("Extracting profile from text...", text.length, "chars");

    const prompt = `You are a CV/resume parser. Extract structured data from the following CV/resume text.

Return a JSON object with these fields:
{
  "name": "Full name",
  "targetRole": "Most recent or target job title",
  "yearsExperience": number or null,
  "skills": ["skill1", "skill2", ...],
  "achievements": "Key achievements in 2-3 sentences",
  "education": [{"degree": "...", "institution": "...", "year": 2020}],
  "workHistory": [{"title": "...", "company": "...", "duration": "2019-2022", "highlights": ["..."]}],
  "projects": [{"name": "...", "description": "...", "tech": ["React", "Node.js"]}],
  "certifications": ["AWS Solutions Architect", ...],
  "languages": [{"name": "English", "level": "Native"}, {"name": "Russian", "level": "Fluent"}],
  "aiSummary": "A 2-sentence professional summary of this person"
}

Be accurate. Only include data that is actually present in the CV. Use null for missing fields.`;

    const responseText = await callGemini(apiKey, prompt, text);

    try {
        const parsed = JSON.parse(responseText);
        return {
            name: parsed.name || undefined,
            targetRole: parsed.targetRole || undefined,
            yearsExperience: parsed.yearsExperience || undefined,
            skills: Array.isArray(parsed.skills) ? parsed.skills : [],
            achievements: parsed.achievements || undefined,
            education: Array.isArray(parsed.education) ? parsed.education : undefined,
            workHistory: Array.isArray(parsed.workHistory) ? parsed.workHistory : undefined,
            projects: Array.isArray(parsed.projects) ? parsed.projects : undefined,
            certifications: Array.isArray(parsed.certifications) ? parsed.certifications : undefined,
            languages: Array.isArray(parsed.languages) ? parsed.languages : undefined,
            aiSummary: parsed.aiSummary || undefined
        };
    } catch (err) {
        logger.error("Failed to parse extracted profile:", err);
        throw new Error("AI returned invalid JSON for profile extraction");
    }
}

/**
 * Extract structured company context from a job description
 */
export async function extractCompanyFromText(
    apiKey: string,
    text: string
): Promise<ExtractedCompany> {
    logger.info("Extracting company context from text...", text.length, "chars");

    const prompt = `You are a job description parser. Extract structured data from the following job posting.

Return a JSON object with these fields:
{
  "companyName": "Company name",
  "jobTitle": "Job title",
  "requiredSkills": ["React", "TypeScript", ...],
  "niceToHaveSkills": ["GraphQL", ...],
  "responsibilities": ["Build scalable frontend...", ...],
  "companyValues": ["Innovation", "teamwork", ...],
  "interviewFocus": "Brief note on what this role likely focuses on in interviews",
  "techStack": ["React", "Node.js", "AWS", ...]
}

Be accurate. Only include data that is actually present or strongly implied. Use null for missing fields.`;

    const responseText = await callGemini(apiKey, prompt, text);

    try {
        const parsed = JSON.parse(responseText);
        return {
            companyName: parsed.companyName || "Unknown Company",
            jobTitle: parsed.jobTitle || undefined,
            requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : undefined,
            niceToHaveSkills: Array.isArray(parsed.niceToHaveSkills) ? parsed.niceToHaveSkills : undefined,
            responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : undefined,
            companyValues: Array.isArray(parsed.companyValues) ? parsed.companyValues : undefined,
            interviewFocus: parsed.interviewFocus || undefined,
            techStack: Array.isArray(parsed.techStack) ? parsed.techStack : undefined
        };
    } catch (err) {
        logger.error("Failed to parse extracted company:", err);
        throw new Error("AI returned invalid JSON for company extraction");
    }
}

/**
 * Research a company by name using AI knowledge
 */
export async function researchCompany(
    apiKey: string,
    companyName: string,
    jobTitle?: string
): Promise<CompanyResearch> {
    logger.info("Researching company:", companyName);

    const roleContext = jobTitle ? ` for a ${jobTitle} position` : "";

    const prompt = `You are a career coach helping someone prepare for an interview at ${companyName}${roleContext}.

Return a JSON object with:
{
  "companyInfo": "2-3 sentence overview of the company, what they do, their culture",
  "techStack": ["Known technologies they use"],
  "companyValues": ["Core values or cultural traits"],
  "talkingPoints": ["3-5 specific things the candidate should mention or ask about during the interview"]
}

Use your knowledge. Be specific and actionable. If you don't know much about the company, say so honestly.`;

    const responseText = await callGemini(apiKey, prompt, `Company: ${companyName}\nRole: ${jobTitle || "N/A"}`);

    try {
        const parsed = JSON.parse(responseText);
        return {
            companyInfo: parsed.companyInfo || `${companyName} — company information not available.`,
            techStack: Array.isArray(parsed.techStack) ? parsed.techStack : undefined,
            companyValues: Array.isArray(parsed.companyValues) ? parsed.companyValues : undefined,
            talkingPoints: Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints : undefined
        };
    } catch (err) {
        logger.error("Failed to parse company research:", err);
        throw new Error("AI returned invalid JSON for company research");
    }
}

/**
 * Compute skill match between user profile skills and job requirements
 */
export function computeSkillMatch(
    userSkills: string[],
    requiredSkills: string[],
    niceToHaveSkills?: string[]
): { matched: string[]; gaps: string[] } {
    const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());

    const allRequired = [
        ...requiredSkills,
        ...(niceToHaveSkills || [])
    ];

    const matched: string[] = [];
    const gaps: string[] = [];

    for (const skill of allRequired) {
        const normalized = skill.toLowerCase().trim();
        if (normalizedUserSkills.some(us =>
            us.includes(normalized) || normalized.includes(us)
        )) {
            matched.push(skill);
        } else {
            gaps.push(skill);
        }
    }

    return { matched, gaps };
}
