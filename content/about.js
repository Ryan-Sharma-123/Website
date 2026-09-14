/* ============================================================
   ABOUT PAGE + RÉSUMÉ — replace the placeholders with your own.

   sections: each section becomes a block on the page and an entry
   in the left pop-up tab. A section can have:
     items:  [{ title, subtitle, period, location, details: [..], tags: [..], link: { label, url } }]
     groups: [{ name, items: ["C++", "Python"] }]   // good for skills
     text:   "Markdown paragraph(s)"
   ============================================================ */
window.ABOUT = {
  photo: "assets/images/profile.svg",   // replace with e.g. "assets/images/me.jpg"
  name: "Ryan Sharma",
  headline: "Computer science student who would rather be on a court.",
  blurb: `
Hi, I'm Ryan. I mostly write **C++** and **Python**, with some Java when a class asks for it.
I like problems with a clean answer and games with a messy one. Off the keyboard you'll find
me playing volleyball or basketball, watching anime, or losing at something competitive.

This page is my résumé in one place. Scroll for the details, or use the tab on the left.
`,
  facts: [
    { label: "Based in", value: "Your city, Country" },
    { label: "Studying", value: "Computer Science" },
    { label: "Email", value: "itz.ryansharma@gmail.com", url: "mailto:itz.ryansharma@gmail.com" },
    { label: "GitHub", value: "Ryan-Sharma-123", url: "https://github.com/Ryan-Sharma-123" }
  ],
  // Put a PDF in assets/ and point to it here to show a "Download résumé" button. Leave "" to hide the button.
  resumePdf: "",

  sections: [
    {
      id: "education",
      title: "Education",
      items: [
        {
          title: "Your University",
          subtitle: "B.S. Computer Science",
          period: "2024 – 2028",
          location: "City, Country",
          details: [
            "Relevant coursework: data structures, algorithms, linear algebra, discrete math.",
            "Replace these bullets with your own."
          ]
        },
        {
          title: "Your High School",
          subtitle: "High school diploma",
          period: "2020 – 2024",
          details: ["Volleyball team captain. Math club. Replace me."]
        }
      ]
    },
    {
      id: "experience",
      title: "Experience",
      items: [
        {
          title: "Software Intern",
          subtitle: "Some Company",
          period: "Summer 2025",
          location: "Remote",
          details: [
            "Built a thing in C++ that made another thing faster.",
            "Wrote Python tooling the team still uses.",
            "Replace these bullets with what you actually did."
          ],
          tags: ["C++", "Python", "Git"]
        },
        {
          title: "Teaching Assistant",
          subtitle: "Intro to Programming",
          period: "2024 – 2025",
          details: ["Ran weekly labs for 40 students. Graded assignments. Replace me."]
        }
      ]
    },
    {
      id: "projects",
      title: "Selected projects",
      items: [
        {
          title: "Conway's Game of Life",
          subtitle: "C++ → WebAssembly",
          period: "2025",
          link: { label: "See project", url: "#/projects/game-of-life" },
          details: ["Cellular automaton with an interactive browser front end."]
        },
        {
          title: "Volleyball Stat Tracker",
          subtitle: "Java, SQLite",
          period: "2024",
          link: { label: "See project", url: "#/projects/volleyball-stat-tracker" },
          details: ["Bench-side stat tracking with live hitting efficiency."]
        }
      ]
    },
    {
      id: "skills",
      title: "Skills",
      groups: [
        { name: "Languages", items: ["C++", "Python", "Java", "JavaScript", "SQL"] },
        { name: "Tools", items: ["Git", "Linux", "CMake", "VS Code", "LaTeX"] },
        { name: "Interests", items: ["Algorithms", "Graphics", "Game dev", "Competitive programming"] }
      ]
    },
    {
      id: "awards",
      title: "Awards",
      items: [
        { title: "Some Math Competition", subtitle: "Honourable mention", period: "2024" },
        { title: "Hackathon", subtitle: "2nd place, 48 hours, too much caffeine", period: "2023" }
      ]
    },
    {
      id: "beyond",
      title: "Beyond the keyboard",
      text: `
Volleyball (outside hitter, working on my quick), basketball on weekends, and a running list of
anime I keep telling people to watch. I also like slow math: the kind you do with a pencil and no deadline.
`
    }
  ]
};
