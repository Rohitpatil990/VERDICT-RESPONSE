import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Send, ShieldAlert, Sparkles, X, MapPin } from 'lucide-react';
import { useI18n } from '../i18n.js';
import { ApiClient } from '../api.js';
import lexiconData from '../../../../assets/lexicon.json';

interface FieldReportModalProps {
  currentRegion: any;
  defaultCoords?: { lat: number; lng: number; name?: string };
  onClose: () => void;
  onSuccess: () => void;
}

export const FieldReportModal: React.FC<FieldReportModalProps> = ({
  currentRegion,
  defaultCoords,
  onClose,
  onSuccess
}) => {
  const { t, lang } = useI18n();

  const [incidentType, setIncidentType] = useState('flood');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [suggestedType, setSuggestedType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ackState, setAckState] = useState<any>(null);

  // Rule-based lexicon keyword matcher
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDescription(text);

    const lower = text.toLowerCase();
    for (const rule of lexiconData.rules) {
      const keywords = (rule.keywords as any)[lang] || rule.keywords.en;
      if (keywords.some((kw: string) => lower.includes(kw.toLowerCase()))) {
        setSuggestedType(rule.incidentType);
        if (rule.severity) setSeverity(rule.severity as any);
        break;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        incidentType,
        description: {
          original: {
            lang,
            text: description
          }
        },
        location: {
          lat: defaultCoords?.lat || 19.0688,
          lng: defaultCoords?.lng || 72.8795,
          source: 'GPS_DEVICE',
          accuracyM: 5,
          placeText: defaultCoords?.name || 'Field Location'
        },
        severity: {
          value: severity,
          source: 'CONFIRMED'
        },
        source: {
          kind: 'person',
          id: `worker-${currentRegion}`,
          displayName: `Field Worker (${currentRegion.toUpperCase()})`,
          tier: 'FIELD_OFFICER'
        },
        channel: 'FORM'
      };

      const res = await ApiClient.submitReport(currentRegion, payload);
      setAckState(res.ackState);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1100] flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl w-full max-w-lg shadow-xl overflow-hidden text-[#172033]">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <ShieldAlert size={16} />
            </div>
            <div>
              <h3 className="font-bold text-xs text-[#172033]">Log Incident Report</h3>
              <p className="text-[10px] text-[#64748B]">Immediate local write to {currentRegion.toUpperCase()} store</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#0F172A] p-1 rounded">
            <X size={16} />
          </button>
        </div>

        {ackState ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-50 text-[#15803D] flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <h4 className="text-sm font-bold text-[#172033]">Report Committed to Local Store!</h4>
            <div className="space-y-2 max-w-xs mx-auto text-xs text-left bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
              <div className="flex items-center gap-2 text-[#15803D] font-medium">
                <CheckCircle2 size={13} /> {t('ack.device')}
              </div>
              <div className="flex items-center gap-2 text-[#15803D] font-medium">
                <CheckCircle2 size={13} /> {t('ack.region')} ({currentRegion.toUpperCase()} DB)
              </div>
              <div className="flex items-center gap-2 text-[#B45309] font-medium">
                <Clock size={13} /> {t('ack.pending')}
              </div>
            </div>
            <p className="text-[11px] text-[#64748B]">Replicating via signed op hash chain in background...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
            {/* Incident Type */}
            <div>
              <label className="block text-[#475569] font-medium mb-1">Incident Type</label>
              <select
                value={incidentType}
                onChange={e => setIncidentType(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-2 text-[#172033] outline-none focus:border-[#2563EB]"
              >
                <option value="flood">{t('incidentTypes.flood')}</option>
                <option value="blocked_road">{t('incidentTypes.blocked_road')}</option>
                <option value="stranded_people">{t('incidentTypes.stranded_people')}</option>
                <option value="damaged_infrastructure">{t('incidentTypes.damaged_infrastructure')}</option>
                <option value="medical_emergency">{t('incidentTypes.medical_emergency')}</option>
                <option value="shelter_issue">{t('incidentTypes.shelter_issue')}</option>
                <option value="other">{t('incidentTypes.other')}</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[#475569] font-medium">
                  Disaster Observation Description ({lang.toUpperCase()})
                </label>
                {suggestedType && suggestedType !== incidentType && (
                  <button
                    type="button"
                    onClick={() => setIncidentType(suggestedType)}
                    className="flex items-center gap-1 text-[10px] text-[#2563EB] hover:underline font-semibold"
                  >
                    <Sparkles size={11} /> Suggested: {suggestedType}
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={description}
                onChange={handleDescriptionChange}
                placeholder="Describe field observation (e.g. water level, blocked arterial road, stranded count)..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-2.5 text-[#172033] outline-none focus:border-[#2563EB]"
                required
              />
            </div>

            {/* Severity */}
            <div>
              <label className="block text-[#475569] font-medium mb-1">Severity Tier</label>
              <div className="grid grid-cols-4 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(sev => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`py-1.5 rounded-md font-bold text-[11px] border transition-colors ${
                      severity === sev 
                        ? (sev === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-300' :
                           sev === 'HIGH' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                           'bg-blue-50 text-[#2563EB] border-blue-300')
                        : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Coordinates */}
            <div className="p-2.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] flex items-center justify-between text-[#64748B]">
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin size={13} className="text-[#2563EB]" />
                Location Pin:
              </span>
              <span className="font-mono text-[#172033] font-semibold">
                {defaultCoords ? `${defaultCoords.lat.toFixed(4)}, ${defaultCoords.lng.toFixed(4)}` : '19.0688, 72.8795'}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-md shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Send size={13} />
              <span>{submitting ? 'Signing and Persisting...' : 'Sign & Submit to Regional Store'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
