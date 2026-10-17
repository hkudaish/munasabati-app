export interface CatalogSubcategory { id: string; categoryId: string; nameAr: string; kind: 'standard'|'performer'|'audio'; artistKind: 'male'|'female'|'any'|null; isActive: boolean; sortOrder: number }
export interface CatalogArtist { id: string; nameAr: string; kind: 'male'|'female'; enabled: boolean; sortOrder: number }
export interface ServiceSelection { categoryId: string; subcategoryIds: string[]; artistIds: string[] }
export interface CatalogOptions { subcategories: CatalogSubcategory[]; artists: CatalogArtist[] }
