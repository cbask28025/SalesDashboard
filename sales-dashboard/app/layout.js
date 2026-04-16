import './globals.css'

export const metadata = {
  title: 'Sales Dashboard | K-12 Health Curriculum',
  description: 'Sales automation dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
