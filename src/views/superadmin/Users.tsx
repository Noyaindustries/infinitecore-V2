import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Mail, Package, Shield, Users, Key, Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';

interface UserData {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId?: string;
  referredBy?: string | null;
  referredByPartnerId?: string | null;
  referredByPartnerName?: string | null;
  createdAt: string;
}

export default function SuperAdminUsers() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    // Try to fetch all users first to ensure we see something even if role filter fails due to index issues
    setLoading(true);
    const usersRef = collection(db, 'users');
    
    // Simpler query to avoid composite index requirements for initial load if possible
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as UserData[];

      // Fallback: reconstruit le nom du parrain depuis l'UID partenaire si nécessaire.
      const partnerNameById = new Map<string, string>();
      for (const row of rows) {
        if (String(row.role || '').toLowerCase() !== 'partner') continue;
        const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
        const fallbackLabel = fullName || row.email || `Partenaire ${row.uid}`;
        partnerNameById.set(row.uid, fallbackLabel);
      }

      const usersData = rows.map((row) => ({
        ...row,
        referredByPartnerName:
          row.referredByPartnerName ||
          (row.referredByPartnerId ? partnerNameById.get(row.referredByPartnerId) || null : null),
      })) as UserData[];
      
      // We show all users by default in the SuperAdmin view
      setUsersList(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      // Fallback: try ultra-simple query if ordering fails
      const fallbackQuery = query(usersRef);
      onSnapshot(fallbackQuery, (snapshot) => {
        setUsersList(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }) as UserData));
        setLoading(false);
      }, (err) => {
        toast.error("Erreur critique de base de données");
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string) => {
    if (!selectedRole) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: selectedRole
      });
      toast.success('Rôle mis à jour avec succès');
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error('Erreur lors de la mise à jour du rôle');
    }
  };

  const roles = [
    { name: 'Super Admin', value: 'admin', description: 'Accès total à toutes les fonctionnalités et paramètres du système.' },
    { name: 'Admin (Commando)', value: 'commando', description: 'Gestion des opérations, clients, et pipeline de production.' },
    { name: 'Développeur', value: 'developer', description: 'Accès aux missions assignées, soumission de livrables et suivi des commissions.' },
    { name: 'Partenaire', value: 'partner', description: 'Accès au tableau de bord partenaire, suivi des filleuls et commissions.' },
    { name: 'Client', value: 'client', description: 'Accès au portail client, suivi des projets, documents et support.' },
  ];

  const getRoleLabel = (roleValue: string) => {
    const role = roles.find(r => r.value === roleValue);
    return role ? role.name : roleValue;
  };

  const getRoleColor = (roleValue: string) => {
    switch(roleValue) {
      case 'admin': return 'bg-red-100 text-red-700';
      case 'commando': return 'bg-blue-100 text-blue-700';
      case 'developer': return 'bg-purple-100 text-purple-700';
      case 'partner': return 'bg-orange-100 text-orange-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const permissionsMatrix = [
    { feature: 'Tableau de bord global', superadmin: true, admin: false, developer: false, partner: false, client: false },
    { feature: 'Gestion des utilisateurs', superadmin: true, admin: false, developer: false, partner: false, client: false },
    { feature: 'Pipeline de production', superadmin: true, admin: true, developer: false, partner: false, client: false },
    { feature: 'Gestion financière', superadmin: true, admin: true, developer: false, partner: false, client: false },
    { feature: 'Missions & Livrables', superadmin: true, admin: true, developer: true, partner: false, client: false },
    { feature: 'Suivi des filleuls', superadmin: true, admin: false, developer: false, partner: true, client: false },
    { feature: 'Espace Client (Projets)', superadmin: true, admin: true, developer: false, partner: false, client: true },
    { feature: 'Support & Tickets', superadmin: true, admin: true, developer: false, partner: false, client: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
        <div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">Registre Global des Paramètres</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70 leading-relaxed">Supervision des accès et gestion des privilèges systèmes</p>
        </div>
        </div>
        <div className="bg-noya-blue/10 border border-noya-blue/20 rounded-xl px-4 py-2 flex items-center gap-2 shadow-inner">
          <Users size={16} className="text-noya-blue" />
          <span className="text-sm font-black text-noya-blue">{usersList.length} Inscrits</span>
        </div>
      </div>

      <div className="bg-surface-secondary rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-noya-blue rounded-full"></div>
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-tight">Utilisateurs Indexés</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-primary border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted">
              <Shield size={14} className="text-noya-orange" />
              Politique RBAC Active
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-primary text-text-secondary text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                <th className="p-4">ID</th>
                <th className="p-4">Utilisateur / Entreprise</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Rôle / Statut</th>
                <th className="p-4">Date Inscription</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="w-10 h-10 border-b-2 border-noya-blue rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-text-dim">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-widest text-xs">Aucun client inscrit</p>
                  </td>
                </tr>
              ) : (
                usersList.map((user) => (
                  <tr key={user.uid} className="border-b border-border-subtle hover:bg-surface-primary transition-all group">
                    <td className="p-4">
                      <span className="text-[10px] font-mono text-text-muted block bg-surface-primary px-2 py-1 rounded w-fit" title={user.uid}>{user.uid.slice(0, 8)}...</span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-text-primary group-hover:text-noya-blue transition-colors leading-tight">{user.firstName} {user.lastName}</div>
                      {user.companyId && <div className="text-[10px] text-text-muted font-black uppercase tracking-tighter mt-1">ID ENT : {user.companyId.slice(0, 8)}</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-text-secondary font-medium italic opacity-80">
                        <Mail size={14} className="text-noya-blue/50" /> {user.email}
                      </div>
                      {user.referredByPartnerName ? (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-noya-blue/20 bg-noya-blue/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-noya-blue">
                          Parrain: {user.referredByPartnerName}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center justify-center w-fit px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner ${getRoleColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-noya-green text-[10px] uppercase">
                          <CheckCircle size={10} /> Actif
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-text-secondary/50 font-medium">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editingUser === user.uid ? (
                          <div className="flex items-center gap-2 bg-surface-tertiary p-1 rounded-xl border border-border-subtle animate-in slide-in-from-right-4 duration-300">
                            <select
                              title="Choisir un rôle utilisateur"
                              aria-label="Choisir un rôle utilisateur"
                              value={selectedRole || user.role}
                              onChange={(e) => setSelectedRole(e.target.value)}
                              className="bg-surface-primary border border-border-subtle text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-noya-blue"
                            >
                              {roles.map(r => (
                                <option key={r.value} value={r.value}>{r.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleRoleChange(user.uid)}
                              className="p-1.5 bg-noya-green text-white rounded-lg hover:scale-110 transition-all bg-noya-green/20 text-noya-green"
                              title="Valider"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="p-1.5 bg-noya-red text-white rounded-lg hover:scale-110 transition-all bg-noya-red/20 text-noya-red"
                              title="Annuler"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setEditingUser(user.uid);
                                setSelectedRole(user.role);
                              }}
                              className="p-2 transition-all text-text-secondary/50 hover:text-noya-orange hover:bg-noya-orange/10 rounded-xl group/btn"
                              title="Modifier les privilèges"
                            >
                              <Edit2 size={16} className="group-hover/btn:scale-110 transition-all" />
                            </button>
                            <button 
                              onClick={() => {
                                toast.success("Ouverture du dossier sécurisé...");
                              }}
                              className="p-2 transition-all text-text-secondary/50 hover:text-noya-blue hover:bg-noya-blue/10 rounded-xl group/btn"
                              title="Voir le dossier"
                            >
                              <Package size={18} className="group-hover/btn:scale-110 transition-all" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
