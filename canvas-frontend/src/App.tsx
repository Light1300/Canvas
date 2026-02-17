import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signin from "./components/signin-singup/signin";
import Signup from "./components/signin-singup/signup";
import VerifyOtp from "./components/signin-singup/verifyOtp";
import Landing from "./components/landing/Landing"; 
import JoinRoom from "./components/landing/joinroom/Joinroom";
import CreateRoom from "./components/landing/createroom/Createroom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route */}
        <Route path="/" element={<Navigate to="/signup" />} />

        {/* Signup page */}
        <Route path="/signup" element={<Signup />} />

        {/* Signin page */}
        <Route path="/signin" element={<Signin />} />

        {/* OTP verification */}
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/join-room" element={<JoinRoom />} />
        <Route path="/create-room" element={<CreateRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;