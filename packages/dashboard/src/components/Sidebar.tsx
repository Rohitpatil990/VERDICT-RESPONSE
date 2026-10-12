import React from 'react';
import { 
  LayoutDashboard, 
  AlertCircle, 
  GitBranch, 
  Scale, 
  Activity, 
  Shield, 
  FileText,
  ExternalLink
} from 'lucide-react';
import { useI18n } from '../i18n.js';

export type NavItem = 'overview' | 'incidents' | 'replication' | 'conflicts' | 'health';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  conflictCount: number;
  unresolvedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  conflictCount,
  unresolvedCount
}) => {
  const { t } = useI18n();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'incidents', label: 'Incidents', icon: AlertCircle, badge: unresolvedCount > 0 ? unresolvedCount : undefined },
    { id: 'replication', label: 'Replication', icon: GitBranch },
    { id: 'conflicts', label: 'Conflicts', icon: Scale, badge: conflictCount > 0 ? conflictCount : undefined, badgeColor: 'bg-red-100 text-red-700 border-red-200' },
    { id: 'health', label: 'System Health', icon: Activity }
  ];

  return (
    <aside className="w-56 h-full bg-[#FFFFFF] border-r border-[#E2E8F0] flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-14 px-4 border-b border-[#E2E8F0] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#2563EB] flex items-center justify-center text-white font-black text-sm shadow-sm">
            V
          </div>
          <div>
            <div className="text-xs font-bold text-[#172033] tracking-tight">VERDICT Response</div>
            <div className="text-[10px] text-[#64748B] font-medium leading-none">Disaster Data Protocol</div>
          </div>
        </div>

        {/* Primary Navigation Items */}
        <nav className="p-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as NavItem)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                    : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={15} className={isActive ? 'text-[#2563EB]' : 'text-[#64748B]'} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                    item.badgeColor || 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="text-[10px] text-[#64748B] space-y-1">
          <div className="flex items-center justify-between font-medium">
            <span>Model:</span>
            <span className="text-[#172033] font-semibold">AP (Availability-First)</span>
          </div>
          <div className="flex items-center justify-between font-medium">
            <span>Replication:</span>
            <span className="text-[#15803D] font-semibold">Delta Anti-Entropy</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
