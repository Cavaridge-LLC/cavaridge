/**
 * Visual tenant hierarchy tree.
 * Shows the 4-tier UTM model: Platform → MSP → Client → Site/Prospect
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronDown, Building2, Building, MapPin, User } from 'lucide-react';
import { tenants } from '../lib/api';

const TIER_ICONS: Record<string, any> = {
  platform: Building2,
  msp: Building,
  client: Building,
  site: MapPin,
  prospect: User,
};

const TIER_COLORS: Record<string, string> = {
  platform: 'text-indigo-600 dark:text-indigo-400',
  msp: 'text-blue-600 dark:text-blue-400',
  client: 'text-green-600 dark:text-green-400',
  site: 'text-amber-600 dark:text-amber-400',
  prospect: 'text-gray-500 dark:text-gray-400',
};

const TIER_BG: Record<string, string> = {
  platform: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800',
  msp: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
  client: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
  site: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
  prospect: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800',
};

interface TreeNode {
  id: string;
  name: string;
  type: string;
  status: string;
  child_count: number;
  children: TreeNode[];
}

export function TenantTreePage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [totalTenants, setTotalTenants] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await tenants.tree();
        setTree(data.tree);
        setTotalTenants(data.totalTenants);
      } catch { /* DB not connected */ }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/tenants" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tenant Hierarchy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalTenants} tenants — 4-tier Universal Tenant Model
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {['platform', 'msp', 'client', 'site', 'prospect'].map(tier => (
          <span key={tier} className={`flex items-center gap-1.5 ${TIER_COLORS[tier]}`}>
            {(() => { const Icon = TIER_ICONS[tier]; return <Icon size={12} />; })()}
            <span className="capitalize font-medium">{tier}</span>
          </span>
        ))}
      </div>

      {/* Tree */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading hierarchy...</p>
        ) : tree.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">No tenants found. Create a platform tenant to start.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map(node => (
              <TreeNodeRow key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = TIER_ICONS[node.type] ?? Building2;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <div className={`p-1 rounded ${TIER_BG[node.type]} border`}>
          <Icon size={14} className={TIER_COLORS[node.type]} />
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{node.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${TIER_COLORS[node.type]}`}>
          {node.type}
        </span>
        {node.status !== 'active' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
            {node.status}
          </span>
        )}
        {hasChildren && (
          <span className="text-[10px] text-gray-400">{node.children.length} children</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
