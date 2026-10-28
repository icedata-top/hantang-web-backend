import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import IcedataNavbar from './components/IcedataNavbar.jsx';
import About from './pages/About/index.jsx';
import Home from './pages/Home/index.jsx';
import Overview from './pages/Overview/index.jsx';
import NotFound from './pages/NotFound.jsx';
import UnderDevelopment from './pages/UnderDevelopment.jsx';
import Stash from './pages/Stash/index.jsx';
import UniSeek from './pages/UniSeek/UniSeek.jsx';
import VideoDetail from './pages/video/VideoDetail.jsx';
import ProducerDetail from './pages/producer/ProducerDetail.jsx';
import { ADMIN_ENABLED } from './config/runtimeEnv.js';

const Admin = lazy(() => import('./pages/Admin/index.jsx'));

function AppLayout() {
  const { pathname } = useLocation();
  const useMesh = pathname === '/' || pathname === '/about' || pathname === '/uniseek' || pathname === '/overview';

  useEffect(() => {
    const root = document.documentElement;
    if (useMesh) {
      root.dataset.mesh = 'on';
    } else {
      delete root.dataset.mesh;
    }
    return () => {
      delete root.dataset.mesh;
    };
  }, [useMesh]);

  return (
    <>
      <IcedataNavbar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="overview" element={<Overview />} />
          <Route path="uniseek" element={<UniSeek />} />
          <Route path="stash" element={<Stash />} />
          <Route path="videos" element={<UnderDevelopment />} />
          <Route path="videos/:aid" element={<VideoDetail />} />
          <Route path="vocals" element={<UnderDevelopment />} />
          <Route path="producers" element={<UnderDevelopment />} />
          <Route path="producers/:userId" element={<ProducerDetail />} />
          <Route path="about" element={<About />} />
          {ADMIN_ENABLED && (
            <Route path="admin/*" element={<Suspense fallback={null}><Admin /></Suspense>} />
          )}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
