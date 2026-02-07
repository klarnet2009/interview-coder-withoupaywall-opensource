import React, { useState } from 'react';
import { 
  X, 
  History, 
  Search, 
  Calendar,
  Building2,
  Briefcase,
  Trash2,
  ChevronRight,
  Copy,
  Check,
  Download
} from 'lucide-react';
import { Session, SavedSnippet } from '../../types';

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onExportSession: (id: string) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  isOpen,
  onClose,
  sessions,
  onDeleteSession,
  onExportSession
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');

  const filteredSessions = sessions.filter(session => 
    session.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.snippets.some(s => 
      s.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleCopySnippet = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleViewSession = (session: Session) => {
    setSelectedSession(session);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedSession(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {view === 'detail' ? (
              <button
                onClick={handleBack}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            ) : (
              <History className="w-5 h-5 text-white/60" />
            )}
            <h2 className="text-lg font-semibold text-white">
              {view === 'detail' ? 'Session Details' : 'Session History'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {view === 'detail' && selectedSession && (
              <button
                onClick={() => onExportSession(selectedSession.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
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
          {view === 'list' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sessions, companies, or questions..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Sessions list */}
              {filteredSessions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">
                    {searchQuery ? 'No matching sessions' : 'No sessions yet'}
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    Your interview sessions will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleViewSession(session)}
                      className="group p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            {session.company && (
                              <span className="flex items-center gap-1 text-sm text-white/70">
                                <Building2 className="w-3.5 h-3.5" />
                                {session.company}
                              </span>
                            )}
                            {session.role && (
                              <span className="flex items-center gap-1 text-sm text-white/70">
                                <Briefcase className="w-3.5 h-3.5" />
                                {session.role}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(session.date)} at {formatTime(session.date)}
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-white/50">
                              {session.snippets.length} {session.snippets.length === 1 ? 'snippet' : 'snippets'}
                            </span>
                            {session.notes && (
                              <span className="text-white/30">Has notes</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            className="p-2 text-red-400/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-white/30" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : selectedSession && (
            <div className="space-y-4">
              {/* Session info */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  {selectedSession.company && (
                    <div className="flex items-center gap-1.5 text-sm text-white/70">
                      <Building2 className="w-4 h-4" />
                      {selectedSession.company}
                    </div>
                  )}
                  {selectedSession.role && (
                    <div className="flex items-center gap-1.5 text-sm text-white/70">
                      <Briefcase className="w-4 h-4" />
                      {selectedSession.role}
                    </div>
                  )}
                </div>
                <div className="text-xs text-white/40">
                  {formatDate(selectedSession.date)} at {formatTime(selectedSession.date)}
                </div>
                {selectedSession.notes && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-sm text-white/60">
                    {selectedSession.notes}
                  </div>
                )}
              </div>

              {/* Snippets */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white/80">
                  Saved Snippets ({selectedSession.snippets.length})
                </h3>
                
                {selectedSession.snippets.map((snippet, index) => (
                  <div key={snippet.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30">#{index + 1}</span>
                        <span className="text-xs text-white/40">
                          {new Date(snippet.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {snippet.tags.map((tag, i) => (
                          <span 
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/50 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-white/40 mb-1">Question</div>
                        <p className="text-sm text-white/80">{snippet.question}</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/40">Answer</span>
                          <button
                            onClick={() => handleCopySnippet(snippet.answer, snippet.id)}
                            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                          >
                            {copiedId === snippet.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <div className="text-sm text-white/70 bg-black/30 rounded-lg p-3">
                          {snippet.answer}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionHistory;
