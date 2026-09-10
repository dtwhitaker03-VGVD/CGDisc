import { HashRouter, Route, Routes } from "react-router-dom";
import { AppDataProvider } from "./store/AppDataContext";
import { NavBar } from "./components/NavBar";
import { HomePage } from "./pages/HomePage";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseFormPage } from "./pages/CourseFormPage";
import { PlayersPage } from "./pages/PlayersPage";
import { NewRoundPage } from "./pages/NewRoundPage";
import { RoundsPage } from "./pages/RoundsPage";
import { RoundDetailPage } from "./pages/RoundDetailPage";
import { StatsPage } from "./pages/StatsPage";
import { PlayerStatsPage } from "./pages/PlayerStatsPage";
import { AboutRatingsPage } from "./pages/AboutRatingsPage";

export default function App() {
  return (
    <AppDataProvider>
      <HashRouter>
        <div className="min-h-screen bg-slate-50 pb-20">
          <div className="mx-auto max-w-md px-4 pt-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/new" element={<CourseFormPage />} />
              <Route path="/courses/:id" element={<CourseFormPage />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/round/new" element={<NewRoundPage />} />
              <Route path="/rounds" element={<RoundsPage />} />
              <Route path="/round/:id" element={<RoundDetailPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/stats/:id" element={<PlayerStatsPage />} />
              <Route path="/about-ratings" element={<AboutRatingsPage />} />
            </Routes>
          </div>
        </div>
        <NavBar />
      </HashRouter>
    </AppDataProvider>
  );
}
