export interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
  parentId?: string | null;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Alimentação', color: '#FF6B6B', icon: 'utensils' },
  { name: 'Transporte', color: '#4ECDC4', icon: 'car' },
  { name: 'Moradia', color: '#45B7D1', icon: 'home' },
  { name: 'Lazer', color: '#FFA07A', icon: 'gamepad-2' },
  { name: 'Saúde', color: '#98D8C8', icon: 'heart-pulse' },
  { name: 'Educação', color: '#F7DC6F', icon: 'graduation-cap' },
  { name: 'Compras', color: '#BB8FCE', icon: 'shopping-bag' },
  { name: 'Contas', color: '#85C1E9', icon: 'file-text' },
  { name: 'Salário', color: '#58D68D', icon: 'briefcase' },
  { name: 'Investimentos', color: '#82E0AA', icon: 'trending-up' },
  { name: 'Outros', color: '#BDC3C7', icon: 'more-horizontal' },
  { name: 'Restaurantes', color: '#F1948A', icon: 'utensils-crossed' },
];
