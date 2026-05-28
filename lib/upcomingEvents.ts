export type UpcomingEvent = {
  id: string;
  series: "HYROX" | "TRYKA";
  name: string;
  location: string;
  country: string;
  dateLabel: string;
  startDate: string;
  status: "On sale" | "Announced";
  url: string;
};

const eventList: UpcomingEvent[] = [
  {
    id: "tryka-rds-summer-2026",
    series: "TRYKA",
    name: "Summer Race 4",
    location: "RDS Ireland",
    country: "Ireland",
    dateLabel: "3-5 Jul 2026",
    startDate: "2026-07-03",
    status: "On sale",
    url: "https://tryka.fit/events/",
  },
  {
    id: "tryka-london-race-5-2026",
    series: "TRYKA",
    name: "London Race 5",
    location: "London",
    country: "United Kingdom",
    dateLabel: "5-6 Sep 2026",
    startDate: "2026-09-05",
    status: "On sale",
    url: "https://tryka.fit/events/",
  },
  {
    id: "tryka-lisbon-finale-2026",
    series: "TRYKA",
    name: "Grand Finale",
    location: "Lisbon",
    country: "Portugal",
    dateLabel: "10 Oct 2026",
    startDate: "2026-10-10",
    status: "On sale",
    url: "https://tryka.fit/events/",
  },
  {
    id: "hyrox-birmingham-2026",
    series: "HYROX",
    name: "HYROX Birmingham",
    location: "Birmingham NEC",
    country: "United Kingdom",
    dateLabel: "27 Oct - 1 Nov 2026",
    startDate: "2026-10-27",
    status: "Announced",
    url: "https://hyrox.com/event/hyrox-birmingham/",
  },
  {
    id: "hyrox-dublin-2026",
    series: "HYROX",
    name: "HYROX Dublin",
    location: "RDS Dublin",
    country: "Ireland",
    dateLabel: "11-15 Nov 2026",
    startDate: "2026-11-11",
    status: "Announced",
    url: "https://hyrox.com/event/hyrox-dublin/",
  },
  {
    id: "hyrox-london-excel-2026",
    series: "HYROX",
    name: "HYROX London ExCel",
    location: "London ExCel",
    country: "United Kingdom",
    dateLabel: "2-6 Dec 2026",
    startDate: "2026-12-02",
    status: "Announced",
    url: "https://hyrox.com/find-my-race/",
  },
];

export const upcomingEvents = [...eventList].sort((a, b) =>
  a.startDate.localeCompare(b.startDate),
);
