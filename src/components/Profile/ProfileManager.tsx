import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  User, 
  Briefcase, 
  Award, 
  Trash2, 
  Edit2, 
  Check, 
  FileText, 
  Upload,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../types';

export interface ProfileManagerProps {
  isOpen?: boolean;
  onClose?: () => void;
  profiles: UserProfile[];
  activeProfileId?: string;
  onCreateProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProfile: (id: string, updates: Partial<UserProfile>) => void;
  onDeleteProfile: (id: string) => void;
  onSetActiveProfile: (id: string) => void;
  embedded?: boolean;
}

const COMMUNICATION_TONES = [
  { value: 'formal', label: 'Formal', description: 'Professional and structured' },
  { value: 'professional', label: 'Professional', description: 'Friendly but professional' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' }
];

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  isOpen = true,
  onClose,
  profiles,
  activeProfileId,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onSetActiveProfile,
  embedded = false
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    targetRole: string;
    yearsExperience: string;
    skills: string;
    achievements: string;
    tone: 'formal' | 'professional' | 'casual';
    cvText: string;
    emphasis: string;
    avoid: string;
  }>({
    name: '',
    targetRole: '',
    yearsExperience: '',
    skills: '',
    achievements: '',
    tone: 'professional',
    cvText: '',
    emphasis: '',
    avoid: ''
  });

  useEffect(() => {
    if (isEditing && editingProfile) {
      setFormData({
        name: editingProfile.name,
        targetRole: editingProfile.targetRole || '',
        yearsExperience: editingProfile.yearsExperience?.toString() || '',
        skills: editingProfile.skills.join(', '),
        achievements: editingProfile.achievements || '',
        tone: editingProfile.tone || 'professional',
        cvText: editingProfile.cvText || '',
        emphasis: editingProfile.emphasis || '',
        avoid: editingProfile.avoid || ''
      });
    } else if (isEditing && !editingProfile) {
      // New profile
      setFormData({
        name: '',
        targetRole: '',
        yearsExperience: '',
        skills: '',
        achievements: '',
        tone: 'professional',
        cvText: '',
        emphasis: '',
        avoid: ''
      });
    }
  }, [isEditing, editingProfile]);

  const handleSave = () => {
    const profileData = {
      name: formData.name || 'New Profile',
      targetRole: formData.targetRole || undefined,
      yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience, 10) : undefined,
      skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      achievements: formData.achievements || undefined,
      tone: formData.tone,
      cvText: formData.cvText || undefined,
      emphasis: formData.emphasis || undefined,
      avoid: formData.avoid || undefined
    };

    if (editingProfile) {
      onUpdateProfile(editingProfile.id, profileData);
    } else {
      onCreateProfile(profileData);
    }

    setIsEditing(false);
    setEditingProfile(null);
  };

  const handleEdit = (profile: UserProfile) => {
    setEditingProfile(profile);
    setIsEditing(true);
  };

  const handleNew = () => {
    setEditingProfile(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingProfile(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          cvText: (event.target?.result as string) || ''
        }));
      };
      reader.readAsText(file);
    }
  };

  if (!embedded && !isOpen) return null;

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`flex items-center justify-between pb-3 border-b border-white/10 ${embedded ? '' : 'px-6 py-4'}`}>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-white/60" />
          <h3 className="text-sm font-semibold text-white">
            {isEditing ? (editingProfile ? 'Edit Profile' : 'New Profile') : 'Personal Profiles'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={handleNew}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New Profile
            </button>
          )}
          {!embedded && onClose && (
            <button
              onClick={onClose}
              aria-label={t('a11y.label.closeProfileManager')}
              className="p-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className={`flex-1 overflow-y-auto ${embedded ? 'py-4' : 'p-6'}`}>
        {isEditing ? (
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80">Profile Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Senior Fullstack Engineer"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Target Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Target Role
              </label>
              <input
                type="text"
                value={formData.targetRole}
                onChange={(e) => setFormData(prev => ({ ...prev, targetRole: e.target.value }))}
                placeholder="e.g., Senior Frontend Engineer"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Years and Tone row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  Years Experience
                </label>
                <input
                  type="number"
                  value={formData.yearsExperience}
                  onChange={(e) => setFormData(prev => ({ ...prev, yearsExperience: e.target.value }))}
                  placeholder="5"
                  min="0"
                  max="50"
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/80">Communication Tone</label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value as 'formal' | 'professional' | 'casual' }))}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  {COMMUNICATION_TONES.map(tone => (
                    <option key={tone.value} value={tone.value}>{tone.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80">Key Skills (comma separated)</label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                placeholder="React, TypeScript, Node.js, System Design"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Achievements */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80">Key Achievements</label>
              <textarea
                value={formData.achievements}
                onChange={(e) => setFormData(prev => ({ ...prev, achievements: e.target.value }))}
                placeholder="Led migration to microservices, improved latency by 40%..."
                rows={3}
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
              />
            </div>

            {/* CV Text / Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Resume / CV Text
              </label>
              <div className="flex gap-2 mb-1.5">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer text-xs text-white/70 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-white/50" />
                  <span>Upload .txt / .doc</span>
                  <input
                    type="file"
                    accept=".txt,.doc,.docx,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                value={formData.cvText}
                onChange={(e) => setFormData(prev => ({ ...prev, cvText: e.target.value }))}
                placeholder="Paste your CV text or raw resume details here..."
                rows={3}
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
              />
              {formData.cvText && (
                <div className="text-[11px] text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  CV content loaded ({formData.cvText.length} chars)
                </div>
              )}
            </div>

            {/* Emphasis / Avoid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/80">What to Emphasize</label>
                <textarea
                  value={formData.emphasis}
                  onChange={(e) => setFormData(prev => ({ ...prev, emphasis: e.target.value }))}
                  placeholder="System design, scale, leadership..."
                  rows={2}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/80">What to Avoid</label>
                <textarea
                  value={formData.avoid}
                  onChange={(e) => setFormData(prev => ({ ...prev, avoid: e.target.value }))}
                  placeholder="Junior tasks, specific legacy tools..."
                  rows={2}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-white/90 transition-colors"
              >
                Save Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
                <User className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-xs text-white/50">No profiles created yet</p>
                <p className="text-[11px] text-white/30 mt-0.5">Create a profile to personalize AI answers to your experience</p>
                <button
                  onClick={handleNew}
                  className="mt-3 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Profile
                </button>
              </div>
            ) : (
              profiles.map((profile) => {
                const isActive = activeProfileId === profile.id;
                return (
                  <div
                    key={profile.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-white/10 border-white/30 shadow-md'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-white truncate">{profile.name}</h4>
                          {isActive && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-green-500/20 text-green-400 border border-green-500/30 rounded font-medium flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Active
                            </span>
                          )}
                        </div>
                        
                        {profile.targetRole && (
                          <p className="text-xs text-white/60 mt-0.5">{profile.targetRole}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-white/40">
                          {profile.yearsExperience !== undefined && (
                            <span className="bg-white/5 px-1.5 py-0.5 rounded">{profile.yearsExperience} yrs exp</span>
                          )}
                          {profile.skills && profile.skills.length > 0 && (
                            <span className="bg-white/5 px-1.5 py-0.5 rounded">{profile.skills.length} skills</span>
                          )}
                          {profile.cvText && (
                            <span className="text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded">CV attached</span>
                          )}
                          <span className="capitalize bg-white/5 px-1.5 py-0.5 rounded">{profile.tone || 'professional'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {!isActive && (
                          <button
                            onClick={() => onSetActiveProfile(profile.id)}
                            aria-label={t('a11y.label.setActiveProfile')}
                            className="p-1.5 text-white/40 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Set as active profile"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(profile)}
                          aria-label={t('a11y.label.editProfile')}
                          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {profiles.length > 1 && (
                          <button
                            onClick={() => onDeleteProfile(profile.id)}
                            aria-label={t('a11y.label.deleteProfile')}
                            className="p-1.5 text-red-400/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Delete profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-base border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {content}
      </div>
    </div>
  );
};

export default ProfileManager;
