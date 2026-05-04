import './globals.css'

export const metadata = {
  title: 'Choosing the Best — Sales Dashboard',
  description: 'K-12 Health Curriculum sales automation',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
