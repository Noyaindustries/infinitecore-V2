import { create } from 'zustand';

export type Client = {
  id: string;
  name: string;
  email: string;
  company: string;
  pack: string;
  date: string;
  status: string;
};

export type Ticket = {
  id: string;
  subject: string;
  status: string;
  date: string;
  priority: string;
  clientName: string;
  clientEmail: string;
  message: string;
};

export type Order = {
  id: string;
  serviceName: string;
  moduleId?: string;
  clientName: string;
  date: string;
  status: string;
};

export type Task = {
  id: string;
  title: string;
  client: string;
  date: string;
  isOrder?: boolean;
  columnId: string;
};

export type Milestone = {
  id: string | number;
  title: string;
  status: 'completed' | 'current' | 'pending';
  date: string;
  comment: string;
};

export type OwnedModule = {
  id: string;
  moduleId: string;
  name: string;
  username: string;
  password: string;
  status: 'active' | 'pending';
};

interface AppState {
  currentUser: { name: string; email: string; company: string; phone?: string; address?: string };
  clients: Client[];
  tickets: Ticket[];
  orders: Order[];
  tasks: Task[];
  milestones: Milestone[];
  ownedModules: OwnedModule[];
  addClient: (client: Omit<Client, 'id' | 'date' | 'status'>) => void;
  addTicket: (ticket: Omit<Ticket, 'id' | 'date' | 'status'>) => void;
  addOrder: (order: Omit<Order, 'id' | 'date' | 'status'>) => void;
  addTask: (task: Omit<Task, 'id' | 'date'>) => void;
  validateOrder: (orderId: string) => void;
  validateClient: (clientId: string) => void;
}

export const useStore = create<AppState>((set) => ({
  currentUser: { name: 'Super Admin', email: 'superadmin@infinitecore.com', company: 'Infinite Core' },
  clients: [
    { id: 'CLI-1001', name: 'Super Admin', email: 'superadmin@infinitecore.com', company: 'Infinite Core', pack: 'Pack Business', date: 'Hier', status: 'Actif' }
  ],
  tickets: [
    { id: '#T-1042', subject: 'Problème accès galerie', status: 'En cours', date: 'Hier, 14:30', priority: 'Moyenne', clientName: 'Super Admin', clientEmail: 'superadmin@infinitecore.com', message: 'Je n\'arrive pas à voir les images de mon audit.' },
    { id: '#T-1038', subject: 'Question facture acompte', status: 'Nouveau', date: 'Aujourd\'hui, 09:15', priority: 'Basse', clientName: 'Super Admin', clientEmail: 'superadmin@infinitecore.com', message: 'Pouvez-vous me renvoyer la facture ?' },
  ],
  orders: [
    { id: 'CMD-1001', serviceName: 'Module Infinite CRM', moduleId: 'crm', clientName: 'Super Admin', date: 'Hier', status: 'Nouveau' }
  ],
  tasks: [
    { id: '1', title: 'Audit PADDE-CI', client: 'Entreprise A', date: 'Aujourd\'hui', columnId: 'lead' },
    { id: '2', title: 'Demande Devis', client: 'Client B', date: 'Hier', columnId: 'lead' },
    { id: '3', title: 'Analyse préliminaire', client: 'Client C', date: 'Il y a 2j', columnId: 'diagnostic' },
    { id: '4', title: 'Visite site', client: 'Entreprise D', date: 'En cours', columnId: 'audit' },
    { id: '5', title: 'Envoi devis', client: 'Client E', date: 'En attente', columnId: 'proposition' },
    { id: '6', title: 'Démarrage projet', client: 'Client F', date: 'Signé', columnId: 'signe' }
  ],
  milestones: [
    { id: 1, title: 'Lead & Contact', status: 'completed', date: '10 Mars 2026', comment: 'Premier contact établi via le site web.' },
    { id: 2, title: 'Diagnostic', status: 'completed', date: '12 Mars 2026', comment: 'Analyse des besoins validée par l\'équipe Commando.' },
    { id: 3, title: 'Audit en cours', status: 'current', date: 'En cours', comment: 'Nos experts sont sur le terrain.' },
    { id: 4, title: 'Proposition Commerciale', status: 'pending', date: '-', comment: 'En attente de la finalisation de l\'audit.' },
    { id: 5, title: 'Contrat Signé', status: 'pending', date: '-', comment: 'Validation finale.' },
  ],
  ownedModules: [],
  addClient: (client) => set((state) => {
    const newClient = {
      ...client,
      id: `CLI-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
      date: 'À l\'instant',
      status: 'Nouveau'
    };

    return {
      clients: [newClient, ...state.clients]
    };
  }),
  addTicket: (ticket) => set((state) => ({
    tickets: [{
      ...ticket,
      id: `#T-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
      date: 'À l\'instant',
      status: 'Nouveau'
    }, ...state.tickets]
  })),
  addOrder: (order) => set((state) => ({
    orders: [{
      ...order,
      id: `CMD-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
      date: 'À l\'instant',
      status: 'Nouveau'
    }, ...state.orders]
  })),
  addTask: (task) => set((state) => ({
    tasks: [{
      ...task,
      id: `TSK-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
      date: 'À l\'instant'
    }, ...state.tasks]
  })),
  validateOrder: (orderId) => set((state) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return state;

    const updatedOrders = state.orders.map(o => 
      o.id === orderId ? { ...o, status: 'Validé' } : o
    );

    let newOwnedModules = [...state.ownedModules];
    let newMilestones = [...state.milestones];

    if (order.moduleId) {
      const username = `admin_${order.moduleId}_${crypto.randomUUID().split('-')[0]}`;
      const pwdArray = new Uint8Array(10);
      crypto.getRandomValues(pwdArray);
      const password = Array.from(pwdArray, b => b.toString(16).padStart(2, '0')).join('');

      newOwnedModules.push({
        id: `MOD-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
        moduleId: order.moduleId,
        name: order.serviceName,
        username,
        password,
        status: 'active'
      });

      // Mark current milestone as completed if it exists, and add a new one
      newMilestones = newMilestones.map(m => m.status === 'current' ? { ...m, status: 'completed' } : m);
      
      newMilestones.push({
        id: Date.now(),
        title: `Accès ${order.serviceName}`,
        status: 'current',
        date: 'Aujourd\'hui',
        comment: `Identifiant: ${username} | Mot de passe: ${password}`
      });
    }

    return {
      orders: updatedOrders,
      ownedModules: newOwnedModules,
      milestones: newMilestones
    };
  }),
  validateClient: (clientId) => set((state) => ({
    clients: state.clients.map(c => 
      c.id === clientId ? { ...c, status: 'Actif' } : c
    )
  }))
}));
