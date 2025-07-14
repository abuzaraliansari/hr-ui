import React from 'react';
import '../App.css'; // Import the CSS file where the classes are defined

function Footer() {
  return (
    <footer className="footer">
      {/* Centered Main Info */}
      <div className="footer-main-info">
        <div className="footer-title">
          Integration <span className="footer-title-made">Made</span> <span className="footer-title-easy">Easy</span>
        </div>
        <div className="footer-contact">
          <i className="fas fa-phone footer-icon"></i><span className="footer-phone">+91-7972143020</span>
           <i className="fas fa-envelope footer-icon"></i>
          <a href="mailto:contactus@intmavens.com" className="footer-email">contactus@intmavens.com</a>
        </div>
      </div>
      {/* Divider */}
      <hr className="footer-divider" />
      {/* Bottom Row: copyright left, socials right */}
      <div className="footer-bottom-row">
        <div className="footer-copyright">
          © 2025 IntMavens. All rights reserved.
        </div>
        <div className="footer-socials">
          <a
            href="https://www.facebook.com/IntMavens"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social-link"
            title="Facebook"
          >
            <i className="fab fa-facebook-f"></i>
          </a>
          <a
            href="https://x.com/IntMavens"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social-link"
            title="X"
          >
            {/* If fa-x-twitter does not show, use fa-twitter as fallback */}
            <i className="fab fa-x-twitter"></i>
          </a>
          <a
            href="https://www.linkedin.com/company/intmavens-infotech/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social-link"
            title="LinkedIn"
          >
            <i className="fab fa-linkedin-in"></i>
          </a>
        </div>
      </div>
    </footer>
  );
}
export default Footer;