import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Console from "./pages/Console";
import Dashboard from "./pages/Dashboard";
import "./layout.css";

export default function App() {
  return (
    <div className="site">
      <Navbar />
      <main className="site-main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/app" element={<Console />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
