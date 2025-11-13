'use client';

import { ReactNode } from 'react';
import Navigation from './Navigation';
import Footer from './Footer';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen excalidraw-bg flex flex-col">
      <Navigation />
      <div className="flex-1 max-w-6xl mx-auto p-6 w-full">
        {children}
      </div>
      <Footer />
    </div>
  );
}
