import '../globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Memovoice Admin',
  description: 'Admin dashboard for Memovoice',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
