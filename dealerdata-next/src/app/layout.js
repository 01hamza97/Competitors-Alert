import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Dealer Dashboard — Performance Suite",
  description: "Automotive dealership lead, competitor, and inventory intelligence platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-gray-50 overflow-hidden font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
