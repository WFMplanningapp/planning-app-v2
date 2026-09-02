import Footer from "./footer";
import Header from "./header";

const PageLayout = ({ children }) => {
  const isDemoEnvironment =
    process.env.NEXT_PUBLIC_APP_ENV === "demo";

  return (
    <div id="page-container">
      <div className="mb-2">
        <Header />

        {isDemoEnvironment && (
          <aside
            className="demo-environment-banner"
            role="status"
            aria-label="Demo environment notice"
          >
            <div className="container px-2">
              <strong>Demo environment</strong>
              <span>
                Use test information only. Do not enter real employee,
                customer, or operational data.
              </span>
            </div>
          </aside>
        )}

        <main className="container px-2">{children}</main>
      </div>

      <Footer />
    </div>
  );
};

export default PageLayout;
