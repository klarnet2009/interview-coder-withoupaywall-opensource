import React, { useEffect, useState } from 'react';
import { User, Briefcase, Award, MessageSquare, FileText } from 'lucide-react';
import { StepProps, UserProfile } from '../../../types';

interface StepProfileProps extends StepProps {
  setCanProceed: (can: boolean) => void;
}

export const StepProfile: React.FC<StepProfileProps> = ({
  data,
  onUpdate,
  setCanProceed
}) => {
  const [profile, setProfile] = useState({
    name: '',
    targetRole: '',
    yearsExperience: '',
    skills: '',
    achievements: '',
    tone: 'professional' as const
  });

  useEffect(() => {
    // Profile is optional, so always allow proceeding
    setCanProceed(true);
  }, [setCanProceed]);

  const handleChange = (field: keyof typeof profile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Create profile if user filled in any info
    if (profile.name || profile.targetRole || profile.skills) {
      const newProfile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        name: profile.name || 'Default Profile',
        targetRole: profile.targetRole,
        yearsExperience: profile.yearsExperience ? parseInt(profile.yearsExperience) : undefined,
        skills: profile.skills.split(',').map(s => s.trim()).filter(Boolean),
        achievements: profile.achievements,
        tone: profile.tone
      };
      
      // Save to config
      onUpdate({
        profiles: [newProfile as UserProfile]
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-white/60">
        Set up your profile to get personalized answers. This helps the AI 
        tailor responses to your experience and style.
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80 flex items-center gap-2">
          <User className="w-4 h-4" />
          Your Name
        </label>
        <input
          type="text"
          value={profile.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., John Doe"
          className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Target Role */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80 flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          Target Role
        </label>
        <input
          type="text"
          value={profile.targetRole}
          onChange={(e) => handleChange('targetRole', e.target.value)}
          placeholder="e.g., Senior Frontend Engineer"
          className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Years of Experience */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80 flex items-center gap-2">
          <Award className="w-4 h-4" />
          Years of Experience
        </label>
        <input
          type="number"
          value={profile.yearsExperience}
          onChange={(e) => handleChange('yearsExperience', e.target.value)}
          placeholder="e.g., 5"
          min="0"
          max="50"
          className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Key Skills (comma separated)
        </label>
        <input
          type="text"
          value={profile.skills}
          onChange={(e) => handleChange('skills', e.target.value)}
          placeholder="e.g., React, TypeScript, Node.js, System Design"
          className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Communication Tone */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Communication Style
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['formal', 'professional', 'casual'] as const).map((tone) => (
            <button
              key={tone}
              onClick={() => handleChange('tone', tone)}
              className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                profile.tone === tone
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/[0.05] text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>

      {/* Skip notice */}
      <div className="text-xs text-white/40 text-center pt-2">
        You can skip this step and set up your profile later in settings.
      </div>
    </div>
  );
};

export default StepProfile;
