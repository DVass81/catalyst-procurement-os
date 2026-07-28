# Y-12 demonstration brand reference

The fictional demonstration uses the current public Y-12 Credit Union identity
as a customer-specific presentation theme. This use does not imply affiliation,
endorsement, sponsorship, or a commercial relationship.

## Central tokens

- Primary navy: `#041A6C`
- Action coral: `#CF4427`
- Catalyst gold: `#EBBF5D`
- Supporting peach: `#F0CB7C`
- Supporting violet: `#404287`
- Warm canvas: `#F7F6F1`
- Ink: `#101B3B`

Coral and gold are accents, not body text on white. Navy remains the primary
structure color, coral is reserved for important actions, and gold provides
guided-demo emphasis. Every status also uses an icon or label so color is never
the only signal.

The tenant manifest lives in `src/config/organizations/y12-demo.ts`; semantic
application tokens live in `src/app/globals.css`. Streamlit remains a separate
fallback surface and should visually track the same palette.

## Public source assets

- Logo:
  `https://www.y12fcu.org/getmedia/6370b89c-c953-4e13-900d-4f65678649e6/Y-12-Logo-White.png?width=1600&height=800&ext=.png`
- Favicon:
  `https://www.y12fcu.org/assets/dist/images/Web-Favicon-40x40.png`
- Public website:
  `https://www.y12fcu.org/`
- 2024 annual report:
  `https://www.y12fcu.org/Y12FCU/media/AnnualReports/2024-Annual-Report.pdf`

Local presentation copies are under `public/brand/y12/`.

## Safety language

Every hosted or presented surface must retain the visible fictional-data and
non-endorsement notice. Do not remove the private-demo boundary when restyling.
