import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { uploadPortfolioImage } from './portfolioUpload';
import type { PortfolioImage } from '../types';

export function useArtisanPortfolio(token: string) {
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  const refreshPortfolio = useCallback(async () => {
    const response = await api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', {
      token,
    }).catch(() => ({ images: [] as PortfolioImage[] }));
    setPortfolioImages(response.images);
  }, [token]);

  useEffect(() => {
    let mounted = true;
    void refreshPortfolio().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, [refreshPortfolio]);

  async function uploadPortfolioFile(file: File, displayOrder: number) {
    setUploadingPortfolio(true);
    try {
      await uploadPortfolioImage(token, file, displayOrder);
      await refreshPortfolio();
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function uploadPortfolioFiles(files: File[]) {
    if (!files.length) return;

    const remainingSlots = Math.max(0, 12 - portfolioImages.length);
    const selectedFiles = files.slice(0, remainingSlots);

    if (!selectedFiles.length) {
      throw new Error('You can upload up to 12 portfolio images.');
    }

    setUploadingPortfolio(true);
    try {
      for (const [index, file] of selectedFiles.entries()) {
        await uploadPortfolioImage(token, file, portfolioImages.length + index);
      }
      await refreshPortfolio();
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function removePortfolioImage(imageId: string) {
    await api(`/artisans/portfolio-images/${imageId}`, {
      method: 'DELETE',
      token,
    });
    await refreshPortfolio();
  }

  return {
    portfolioImages,
    uploadingPortfolio,
    refreshPortfolio,
    uploadPortfolioFile,
    uploadPortfolioFiles,
    removePortfolioImage,
  };
}
