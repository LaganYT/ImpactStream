import type { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";

const ISSUES_URL = "https://github.com/LaganYT/ImpactStream/issues";
const UPDATED = "October 15, 2026";

type Doc = {
  title: string;
  intro: string;
  sections: { heading: string; body: ReactNode }[];
};

const issuesLink = (
  <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
    GitHub issues page
  </a>
);

// Help, Terms, Privacy and DMCA share one layout; each slug is one entry here.
const DOCS: Record<string, Doc> = {
  help: {
    title: "Help",
    intro: "Answers to the questions people ask most.",
    sections: [
      {
        heading: "Do I need an account?",
        body: (
          <p>
            No. ImpactStream has no sign-up or login. Everything works as soon as the page loads.
          </p>
        ),
      },
      {
        heading: "Where are My List and Continue Watching saved?",
        body: (
          <p>
            In this browser only. They don&apos;t sync between devices, and clearing your browser&apos;s
            site data or using a private window will empty them.
          </p>
        ),
      },
      {
        heading: "A video won't play",
        body: (
          <p>
            Video comes from a third-party player, so a title may be missing or slow to start. Reload
            the page, turn off ad or script blockers for the player, or try again later. If a title
            never works, let us know on the {issuesLink}.
          </p>
        ),
      },
      {
        heading: "How do downloads work?",
        body: (
          <p>
            Use the download button on a title or episode. The file comes straight from a third-party
            provider, and the qualities you see are the ones that provider has.
          </p>
        ),
      },
      {
        heading: "Where do Live TV channels come from?",
        body: (
          <p>
            Live TV lists publicly available streams collected by the iptv-org project. Channels go
            offline often; if one doesn&apos;t load, try another.
          </p>
        ),
      },
      {
        heading: "Shortcuts",
        body: (
          <p>
            Press <kbd>/</kbd> on any page to open search, and <kbd>Esc</kbd> to close search, the
            title popup, or the trailer.
          </p>
        ),
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    intro: "By using ImpactStream you agree to these terms.",
    sections: [
      {
        heading: "What ImpactStream is",
        body: (
          <p>
            ImpactStream is a free, open-source index of movies, shows, and anime. It doesn&apos;t
            host, upload, or store any video files. Playback, downloads, and live channels come from
            third-party services that ImpactStream doesn&apos;t run or control.
          </p>
        ),
      },
      {
        heading: "Your responsibility",
        body: (
          <p>
            You&apos;re responsible for making sure that watching or downloading something is legal
            where you live. Don&apos;t use ImpactStream to break the law or to attack, overload, or
            scrape the site.
          </p>
        ),
      },
      {
        heading: "Third-party content",
        body: (
          <p>
            Titles, artwork, and ratings come from TMDB. Video and channels come from outside
            providers. We can&apos;t promise any of it is accurate, available, or safe, and links to
            other sites follow those sites&apos; own terms.
          </p>
        ),
      },
      {
        heading: "No warranty",
        body: (
          <p>
            ImpactStream is provided as is, without any warranty. We aren&apos;t liable for any loss
            or damage that comes from using it.
          </p>
        ),
      },
      {
        heading: "Changes",
        body: (
          <p>
            These terms may change. The date at the top shows when they last did. Using the site after
            a change means you accept the new terms.
          </p>
        ),
      },
    ],
  },
  privacy: {
    title: "Privacy",
    intro: "ImpactStream has no accounts and doesn't collect personal information.",
    sections: [
      {
        heading: "What stays on your device",
        body: (
          <p>
            My List, Continue Watching progress, and settings like autoplay and episode layout are
            saved in your browser&apos;s local storage. They never leave your device, and you can
            remove them by clearing this site&apos;s data.
          </p>
        ),
      },
      {
        heading: "What we don't do",
        body: (
          <p>
            No sign-ups, no tracking or advertising cookies, and no analytics. We don&apos;t sell or
            share data, because we don&apos;t collect any.
          </p>
        ),
      },
      {
        heading: "Services your browser talks to",
        body: (
          <>
            <p>Using the site sends requests to:</p>
            <ul>
              <li>TMDB, for posters and artwork</li>
              <li>The video player and download providers, when you play or download something</li>
              <li>YouTube, when you open a trailer</li>
              <li>Google Fonts, for the site&apos;s typeface</li>
            </ul>
            <p>
              Those services see your IP address and follow their own privacy policies. Our hosting
              provider may also keep standard server logs.
            </p>
          </>
        ),
      },
      {
        heading: "Questions",
        body: <p>Ask on the {issuesLink}.</p>,
      },
    ],
  },
  dmca: {
    title: "DMCA",
    intro: "ImpactStream doesn't host any video files.",
    sections: [
      {
        heading: "Where the content lives",
        body: (
          <p>
            Every video, download, and live channel is served by a third-party provider. Removing a
            title from ImpactStream doesn&apos;t remove it from the internet, so the fastest way to
            take content down is to contact the provider that hosts the file.
          </p>
        ),
      },
      {
        heading: "Sending a notice",
        body: (
          <>
            <p>
              If you still want a title removed from ImpactStream, open a notice on our {issuesLink}{" "}
              with:
            </p>
            <ul>
              <li>The work you own, and the ImpactStream page that shows it</li>
              <li>Your name and a way to reach you</li>
              <li>A statement that you believe in good faith the use isn&apos;t authorized</li>
              <li>
                A statement that your notice is accurate and that you own or represent the rights
              </li>
            </ul>
            <p>We review every notice and remove links that are confirmed.</p>
          </>
        ),
      },
    ],
  },
};

export const getStaticPaths: GetStaticPaths = () => ({
  paths: Object.keys(DOCS).map((doc) => ({ params: { doc } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<{ slug: string }> = ({ params }) => ({
  props: { slug: String(params?.doc) },
});

export default function DocPage({ slug }: { slug: string }) {
  const doc = DOCS[slug];
  return (
    <main className="container doc-page">
      <Head>
        <title>{`${doc.title} · ImpactStream`}</title>
      </Head>
      <nav className="doc-tabs" aria-label="Site information">
        {Object.entries(DOCS).map(([key, { title }]) => (
          <Link key={key} href={`/${key}`} className={key === slug ? "active" : undefined}>
            {title}
          </Link>
        ))}
      </nav>
      <h1>{doc.title}</h1>
      <p className="doc-intro">{doc.intro}</p>
      {slug === "help" ? null : <p className="doc-updated">Last updated {UPDATED}</p>}
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body}
        </section>
      ))}
    </main>
  );
}
