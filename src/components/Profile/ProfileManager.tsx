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
  Upload
} from 'lucide-react';
import { UserProfile } from '../../types';

interface ProfileManagerProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: UserProfile[];
  activeProfileId?: string;
  onCreateProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProfile: (id: string, updates: Partial<UserProfile>) => void;
  onDeleteProfile: (id: string) => void;
  onSetActiveProfile: (id: string) => void;
}

const COMMUNICATION_TONES = [
  { value: 'formal', label: 'Formal', description: 'Professional and structured' },
  { value: 'professional', label: 'Professional', description: 'Friendly but professional' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' }
];

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onSetActiveProfile
}) => {
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
        tone: editingProfile.tone,
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
      yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : undefined,
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
          cvText: event.target?.result as string
        }));
      };
      reader.readAsText(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-white/60" />
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? (editingProfile ? 'Edit Profile' : 'New Profile') : 'Profiles'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing && (
              <button
                onClick={handleNew}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isEditing ? (
            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Profile Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Senior Developer Profile"
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
                  value={formData.targetRole}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetRole: e.target.value }))}
                  placeholder="e.g., Senior Frontend Engineer"
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Years and Skills row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Years Experience
                  </label>
                  <input
                    type="number"
                    value={formData.yearsExperience}
                    onChange={(e) => setFormData(prev => ({ ...prev, yearsExperience: e.target.value }))}
                    placeholder="5"
                    min="0"
                    max="50"
                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">Communication Style</label>
                  <select
                    value={formData.tone}
                    onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value as 'formal' | 'professional' | 'casual' }))}
                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
                  >
                    {COMMUNICATION_TONES.map(tone => (
                      <option key={tone.value} value={tone.value}>{tone.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Key Skills (comma separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                  placeholder="React, TypeScript, Node.js, System Design"
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Achievements */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Key Achievements</label>
                <textarea
                  value={formData.achievements}
                  onChange={(e) => setFormData(prev => ({ ...prev, achievements: e.target.value }))}
                  placeholder="Led migration to microservices, improved performance by 40%..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* CV Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  CV / Resume
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/10 border-dashed rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                    <Upload className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white/50">Upload PDF or TXT</span>
                    <input
                      type="file"
                      accept=".pdf,.txt,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {formData.cvText && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <Check className="w-4 h-4" />
                      CV loaded ({formData.cvText.length} characters)
                    </div>
                  </div>
                )}
              </div>

              {/* Emphasis / Avoid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">What to Emphasize</label>
                  <textarea
                    value={formData.emphasis}
                    onChange={(e) => setFormData(prev => ({ ...prev, emphasis: e.target.value }))}
                    placeholder="Leadership, scalability..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">What to Avoid</label>
                  <textarea
                    value={formData.avoid}
                    onChange={(e) => setFormData(prev => ({ ...prev, avoid: e.target.value }))}
                    placeholder="Specific technologies, topics..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.length === 0 ? (
                <div className="text-center py-12">
                  <User className="w-12 h-12 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">No profiles yet</p>
                  <p className="text-xs text-white/30 mt-1">Create a profile to get personalized answers</p>
                </div>
              ) : (
                profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={`p-4 rounded-xl border transition-all ${
                      activeProfileId === profile.id
                        ? 'bg-white/10 border-white/30'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{profile.name}</h3>
                          {activeProfileId === profile.id && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        
                        {profile.targetRole && (
                          <p className="text-sm text-white/50 mt-1">{profile.targetRole}</p>
                        )}
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                          {profile.yearsExperience !== undefined && (
                            <span>{profile.yearsExperience} years exp</span>
                          )}
                          {profile.skills.length > 0 && (
                            <span>{profile.skills.length} skills</span>
                          )}
                          {profile.cvText && (
                            <span className="text-green-400/60">CV attached</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-4">
                        {activeProfileId !== profile.id && (
                          <button
                            onClick={() => onSetActiveProfile(profile.id)}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Set as active"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(profile)}
                          className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {profiles.length > 1 && (
                          <button
                            onClick={() => onDeleteProfile(profile.id)}
                            className="p-2 text-red-400/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {isEditing && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Save Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileManager;
