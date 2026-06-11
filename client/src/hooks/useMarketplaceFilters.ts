import { useState } from 'react';
import type { MarketplaceSort } from '../appTypes';

export function useMarketplaceFilters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [marketplaceSort, setMarketplaceSort] = useState<MarketplaceSort>('rating');

  return {
    searchTerm,
    setSearchTerm,
    selectedCategoryId,
    setSelectedCategoryId,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    marketplaceSort,
    setMarketplaceSort,
  };
}
