import Footer from "./footer"
import Header from "./header"

const PageLayout = ({ children }) => {
  return (
    <div id="page-container">
      <div className="mb-2">
        <Header />

        <main className="container px-2">{children}</main>
      </div>

      <Footer />
    </div>
  )
}

export default PageLayout
