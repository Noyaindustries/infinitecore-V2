export interface ServiceType {
  id: string;
  name: string;
  price: number;
  devCommission: number;
}

export const SERVICE_CATALOG: ServiceType[] = [
  { id: 'one_page', name: 'Site One Page', price: 49900, devCommission: 4990 },
  { id: 'vitrine', name: 'Site Vitrine', price: 100000, devCommission: 10000 },
  { id: 'ecommerce', name: 'Site E-commerce', price: 1500000, devCommission: 15000 },
];

export function getService(id: string): ServiceType | undefined {
  return SERVICE_CATALOG.find(s => s.id === id);
}
