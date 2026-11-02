export interface Utensil {
    name: string;
    optional?: boolean;
}

/**
 * Fixed default utensil list, shown in session 2 (Ingredient Check) and
 * session 3 (Cooking) so both screens always agree. Recipe JSON has no
 * utensils field; this list applies to every recipe.
 */
export const DEFAULT_UTENSILS: Utensil[] = [
    { name: 'Wok' },
    { name: 'Spatula' },
    { name: 'Cutting Board', optional: true },
];
