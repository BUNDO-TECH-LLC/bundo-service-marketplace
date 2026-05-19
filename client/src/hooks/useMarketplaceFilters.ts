import { useState } from 'react';
import type { MarketplaceSort } from '../appTypes';

export function useMarketplaceFilters() {
  const [selectedState, setSelectedState] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [marketplaceSort, setMarketplaceSort] = useState<MarketplaceSort>('rating');
  const [searchLat, setSearchLat] = useState<number | null>(null);
  const [searchLng, setSearchLng] = useState<number | null>(null);

  function setSearchCoordinates(lat: number | null, lng: number | null) {
    setSearchLat(lat);
    setSearchLng(lng);
  }

  return {
    selectedState,
    setSelectedState,
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
    searchLat,
    searchLng,
    setSearchCoordinates,
  };
}
