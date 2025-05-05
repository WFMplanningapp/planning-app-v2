import Head from 'next/head';

export default function Home({ isConnected }) {
  return (
    <>
      <Head>
        <title>Planning App | Home</title>
      </Head>
      <div className="mt-auto mb-auto">
        <div className="columns">
          <div className="column is-one-quarter">
            <div class="card">
              <a href="/management">
                <div class="card-image">
                  <figure class="image is-4by3">
                    <img src="/management.png" alt="Placeholder image" />
                  </figure>
                </div>
                <div class="card-content">
                  <div class="media">
                    <div class="media-content">
                      <p class="title is-4">Management Page</p>
                    </div>
                  </div>

                  <div class="content">
                    The place to manage everything from Projects, LOBs,
                    capPlans, etc..., keep in mind that access is dependent of
                    your user's access level.
                  </div>
                </div>
              </a>
            </div>
          </div>
          <div className="column is-one-quarter">
            <div class="card">
              <a href="/capacity">
                <div class="card-image">
                  <figure class="image is-4by3">
                    <img src="/capacity.png" alt="Placeholder image" />
                  </figure>
                </div>
                <div class="card-content">
                  <div class="media">
                    <div class="media-content">
                      <p class="title is-4">Capacity Page</p>
                    </div>
                  </div>

                  <div class="content">
                    The place to manage everything from Projects, LOBs,
                    capPlans, etc..., keep in mind that access is dependent of
                    your user's access level.
                  </div>
                </div>
              </a>
            </div>
          </div>
          <div className="column is-one-quarter">
            <div class="card">
              <a href="/staffing">
                <div class="card-image">
                  <figure class="image is-4by3">
                    <img src="/staffing.png" alt="Placeholder image" />
                  </figure>
                </div>
                <div class="card-content">
                  <div class="media">
                    <div class="media-content">
                      <p class="title is-4">Staffing Page</p>
                    </div>
                  </div>

                  <div class="content">
                    The place to manage everything from Projects, LOBs,
                    capPlans, etc..., keep in mind that access is dependent of
                    your user's access level.
                  </div>
                </div>
              </a>
            </div>
          </div>
          <div className="column is-one-quarter">
            <div class="card">
              <a href="/report">
                <div class="card-image">
                  <figure class="image is-4by3">
                    <img src="/report.png" alt="Placeholder image" />
                  </figure>
                </div>
                <div class="card-content">
                  <div class="media">
                    <div class="media-content">
                      <p class="title is-4">Reporting Page</p>
                    </div>
                  </div>

                  <div class="content">
                    The place to manage everything from Projects, LOBs,
                    capPlans, etc..., keep in mind that access is dependent of
                    your user's access level.
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
