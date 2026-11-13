export const products = [
	{ id: 'mug', name: 'Coffee mug', price: 1200, currency: 'EUR' },
	{ id: 'tee', name: 'T-shirt', price: 2500, currency: 'EUR' },
	{ id: 'cap', name: 'Cap', price: 1800, currency: 'EUR' },
] as const;

export const formatMoney = (amount: number, currency: string) =>
	new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100);
