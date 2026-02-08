import React, { useEffect, useState, useCallback } from 'react';
import { User, Briefcase, Award, MessageSquare, FileText, Upload, Building2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { StepProps, UserProfile } from '../../../types';

interface StepProfileProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

type TabId = 'cv' | 'manual' | 'company';

interface CvUploadState {
  status: 'idle' | 'uploading' | 'parsing' | 'done' | 'error';
  fileName?: string;
  error?: string;
  extractedSkills?: string[];
}

interface CompanyState {
  status: 'idle' | 'parsing' | 'researching' | 'done' | 'error';
  companyName?: string;
  jobTitle?: string;
  error?: string;
}

export const StepProfile: React.FC<StepProfileProps> = ({
  onUpdate,
  setCanProceed
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('cv');
  const [profile, setProfile] = useState<{ name: string; targetRole: string; yearsExperience: string; skills: string; achievements: string; tone: 'formal' | 'professional' | 'casual' }>({
    name: '',
    targetRole: '',
    yearsExperience: '',
    skills: '',
    achievements: '',
    tone: 'professional'
  });
  const [cvState, setCvState] = useState<CvUploadState>({ status: 'idle' });
  const [companyState, setCompanyState] = useState<CompanyState>({ status: 'idle' });
  const [jobDescriptionText, setJobDescriptionText] = useState('');

  useEffect(() => {
    // Profile is optional, so always allow proceeding
    setCanProceed(true);
  }, [setCanProceed]);

  const syncProfile = useCallback(() => {
    if (!(profile.name || profile.targetRole || profile.skills || profile.achievements)) {
      return;
    }

    const newProfile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
      name: profile.name || 'Default Profile',
      targetRole: profile.targetRole,
      yearsExperience: profile.yearsExperience ? parseInt(profile.yearsExperience, 10) : undefined,
      skills: profile.skills.split(',').map(s => s.trim()).filter(Boolean),
      achievements: profile.achievements,
      tone: profile.tone
    };

    onUpdate({
      profiles: [newProfile as UserProfile]
    });
  }, [profile, onUpdate]);

  useEffect(() => {
    syncProfile();
  }, [syncProfile]);

  const handleChange = (field: keyof typeof profile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleCvUpload = async () => {
    setCvState({ status: 'uploading' });
    try {
      const result = await window.electronAPI.uploadCv();
      if (result.canceled) {
        setCvState({ status: 'idle' });
        return;
      }
      if (!result.success) {
        setCvState({ status: 'error', error: result.error || 'Upload failed' });
        return;
      }

      const p = result.profile as {
        name?: string;
        targetRole?: string;
        yearsExperience?: number;
        skills?: string[];
        achievements?: string;
        tone?: string;
      };

      // Auto-fill manual edit fields from extracted data
      if (p) {
        setProfile(prev => ({
          ...prev,
          name: p.name || prev.name,
          targetRole: p.targetRole || prev.targetRole,
          yearsExperience: p.yearsExperience?.toString() || prev.yearsExperience,
          skills: p.skills?.join(', ') || prev.skills,
          achievements: p.achievements || prev.achievements,
          tone: (p.tone as 'formal' | 'professional' | 'casual') || prev.tone
        }));
      }

      setCvState({
        status: 'done',
        fileName: result.fileName,
        extractedSkills: (p?.skills as string[]) || []
      });
    } catch (err) {
      setCvState({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleJobDescriptionUpload = async () => {
    setCompanyState({ status: 'parsing' });
    try {
      const result = await window.electronAPI.uploadJobDescription();
      if (result.canceled) {
        setCompanyState({ status: 'idle' });
        return;
      }
      if (!result.success) {
        setCompanyState({ status: 'error', error: result.error || 'Upload failed' });
        return;
      }

      const c = result.company as { companyName?: string; jobTitle?: string };
      setCompanyState({
        status: 'done',
        companyName: c?.companyName,
        jobTitle: c?.jobTitle
      });
    } catch (err) {
      setCompanyState({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleJobTextParse = async () => {
    if (!jobDescriptionText.trim()) return;
    setCompanyState({ status: 'parsing' });
    try {
      const result = await window.electronAPI.parseJobText(jobDescriptionText);
      if (!result.success) {
        setCompanyState({ status: 'error', error: result.error || 'Parse failed' });
        return;
      }

      const c = result.company as { companyName?: string; jobTitle?: string };
      setCompanyState({
        status: 'done',
        companyName: c?.companyName,
        jobTitle: c?.jobTitle
      });
    } catch (err) {
      setCompanyState({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'cv', label: 'CV Upload', icon: Upload },
    { id: 'manual', label: 'Manual Edit', icon: FileText },
    { id: 'company', label: 'Company', icon: Building2 },
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm text-white/60">
        Set up your profile to get personalized answers. Upload your CV for auto-extraction,
        edit manually, or add company context.
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.05] rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.05]'
              }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CV Upload Tab */}
      {activeTab === 'cv' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center hover:border-white/25 transition-colors">
            {cvState.status === 'idle' && (
              <>
                <Upload className="w-8 h-8 text-white/30 mx-auto mb-3" />
                <p className="text-sm text-white/60 mb-3">Upload your CV/Resume (PDF)</p>
                <button
                  onClick={handleCvUpload}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white/80 transition-colors"
                >
                  Choose File
                </button>
              </>
            )}

            {(cvState.status === 'uploading' || cvState.status === 'parsing') && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-sm text-white/60">
                  {cvState.status === 'uploading' ? 'Reading PDF...' : 'Extracting profile with AI...'}
                </p>
              </div>
            )}

            {cvState.status === 'done' && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
                <p className="text-sm text-white/80">
                  <span className="font-medium">{cvState.fileName}</span> processed successfully!
                </p>
                {cvState.extractedSkills && cvState.extractedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                    {cvState.extractedSkills.slice(0, 8).map((skill, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white/10 rounded-md text-xs text-white/70">
                        {skill}
                      </span>
                    ))}
                    {cvState.extractedSkills.length > 8 && (
                      <span className="px-2 py-0.5 text-xs text-white/40">
                        +{cvState.extractedSkills.length - 8} more
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={handleCvUpload}
                  className="text-xs text-white/40 hover:text-white/60 underline mt-1"
                >
                  Upload different file
                </button>
              </div>
            )}

            {cvState.status === 'error' && (
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-red-400/80">{cvState.error}</p>
                <button
                  onClick={() => setCvState({ status: 'idle' })}
                  className="text-xs text-white/40 hover:text-white/60 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-white/40 text-center">
            Your CV will be parsed locally and sent to AI for skill extraction.
            Data stays on your device.
          </div>
        </div>
      )}

      {/* Manual Edit Tab */}
      {activeTab === 'manual' && (
        <div className="space-y-3">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Your Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., John Doe"
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Target Role */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              Target Role
            </label>
            <input
              type="text"
              value={profile.targetRole}
              onChange={(e) => handleChange('targetRole', e.target.value)}
              placeholder="e.g., Senior Frontend Engineer"
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Years of Experience */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Years of Experience
            </label>
            <input
              type="number"
              value={profile.yearsExperience}
              onChange={(e) => handleChange('yearsExperience', e.target.value)}
              placeholder="e.g., 5"
              min="0"
              max="50"
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Skills */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Key Skills (comma separated)
            </label>
            <input
              type="text"
              value={profile.skills}
              onChange={(e) => handleChange('skills', e.target.value)}
              placeholder="e.g., React, TypeScript, Node.js"
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Communication Tone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Communication Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['formal', 'professional', 'casual'] as const).map((tone) => (
                <button
                  key={tone}
                  onClick={() => handleChange('tone', tone)}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${profile.tone === tone
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/[0.05] text-white/60 border border-white/10 hover:bg-white/10'
                    }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Company Tab */}
      {activeTab === 'company' && (
        <div className="space-y-4">
          <div className="text-xs text-white/50">
            Add job description to tailor AI responses to the specific company and role.
          </div>

          {/* Upload JD as PDF */}
          <div className="flex gap-2">
            <button
              onClick={handleJobDescriptionUpload}
              disabled={companyState.status === 'parsing' || companyState.status === 'researching'}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-lg text-xs text-white/80 transition-colors flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload JD (PDF)
            </button>
          </div>

          {/* Or paste text */}
          <div className="space-y-2">
            <label className="text-xs text-white/50">Or paste job description text:</label>
            <textarea
              value={jobDescriptionText}
              onChange={(e) => setJobDescriptionText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={4}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
            />
            <button
              onClick={handleJobTextParse}
              disabled={!jobDescriptionText.trim() || companyState.status === 'parsing'}
              className="w-full px-3 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-lg text-xs text-white/80 transition-colors"
            >
              {companyState.status === 'parsing' ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing...
                </span>
              ) : (
                'Analyze Job Description'
              )}
            </button>
          </div>

          {/* Company result */}
          {companyState.status === 'done' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-green-400 font-medium">
                  {companyState.companyName || 'Company'} — {companyState.jobTitle || 'Position'}
                </p>
                <p className="text-xs text-white/50 mt-0.5">
                  Context saved. AI will tailor answers to this role.
                </p>
              </div>
            </div>
          )}

          {companyState.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-400">{companyState.error}</p>
                <button
                  onClick={() => setCompanyState({ status: 'idle' })}
                  className="text-xs text-white/40 hover:text-white/60 underline mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skip notice */}
      <div className="text-xs text-white/40 text-center pt-1">
        You can skip this step and set up your profile later in settings.
      </div>
    </div>
  );
};

export default StepProfile;
