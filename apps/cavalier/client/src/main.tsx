import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { TenantProvider } from './context/TenantContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <TenantProvider>
          <App />
        </TenantProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
