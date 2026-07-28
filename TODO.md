# TODO

commit it. rebase main to check for conflicts. if no conflicts, merge to main and delete the worktree

### done
- My Fringe panel should be collapsible/viewable on demand
    - selecting a show time should show the My Fringe panel with the newly added show
    - the user can click an X in the top right corner of the panel to collapse the panel
- My Fringe panel should be accessible from Grid view
    - similar to Card view, selecting a show in Grid view should open the My Fringe panel and show the newly selected show
- clicking My Fringe button in topbar should open the My Fringe panel, not the "Take it With You" modal
    - do you think we need another Export button to open the "Take it With You" modal or is the "Sync to another device" button on the My Fringe panel sufficient?
- Cards view should not have a max width. the cards are responsive and can full the full width

### done
- ICS and JSON export buttons in "Take it With You" modal should be greyed out if no shows are selected
- Filter modal should have a max width similar to the "Take it With You" modal because 100% max width doesn't look good on wide viewports
- Replace Star icon button on cards with an info icon button similar to grid card
    - clicking info icon opens show details panel
    - we don't need a select all showtimes option; user has to click the day buttons in the card to add each showtime
- remove "X Shown" from FilterBar in Cards view
- We don't need the grid body header
    - the selected date is already visible in the day strip
    - the legend isn't necessary; the grid features are intuitive already

### done
- the scraper should pull the image source urls for each show from simpletix
    - if dynamic sizing is not possible using the simpletix source, then we'll download the images and host them 
    - image should be shown in cards and in show detail panel
    - does this require an update to the scraper and show metadata schema?    
- what if we rename the scripts directory to scraper and break up the scraper into modular files so that it's easier to grok for a developer instead of one long file?

### done
- we need to manage the content warnings list. it is free form text for the shows but has a lot of similar entries
    - create a mapping for condensed list that covers all of the different options from the shows
    - we'll write the simplified string to the show, so the filter only has a few selections
- to start, create an md file with the proposed mapping; i'll review and we'll work together to get an acceptable list    

### no worktree yet
- Get Tickets button should open the corresponding simpletix page in a new tab for each show in the My Fringe panel
    - this probably requires an update to the scraper and show metadata schema
