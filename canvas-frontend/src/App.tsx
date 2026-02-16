import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signup from "./components/signin-singup/signup";
import Signin from "./components/signin-singup/signin";
import VerifyOtp from "./components/signin-singup/verifyOtp";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/signin" element={<Signin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;