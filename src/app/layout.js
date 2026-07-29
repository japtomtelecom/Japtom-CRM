import './globals.css';

export const metadata = {
  title: 'JapTom Telecom — CRM',
  description: 'Gestión de clientes, pagos y control mensual — JapTom Telecom',
  manifest: '/manifest.json',
  themeColor: '#2f847a',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JapTom CRM',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#2f847a" />
      </head>
      <body className="bg-brand-50 text-brand-900 font-body antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function(){});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
