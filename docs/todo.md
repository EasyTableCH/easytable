```markdown
# TODOs

- [x] Add email / pw-reset functionality library for email
	- Use https://resend.com/ lib
	- include api side (localMaster and relaySyncApi)
	- Add in pfadmin functionality for pw and pin reset for employees
	- Add in staff pwa owner module a "Mitarbeiter" view, where crud is possible for employees and include there also reset pw for employees


- [ ] Add payment functionality
	- Soon wallee pax terminal will arrive
    as soon as we have it we can start mocking
    payments with a terminal (not yet arrived)
    - We should analyze the wallee docs with wallee skill we made for terminal integration and discuss how we channel subtenants in the future for walle we will be a platform so we have subtenants
    - We need to think trough how we bring the "whole" system flowing


- [ ] check if bidirectional syncs really happen
    - meant is: assuming we have a owner of a restaurant, he is home, he wants to edit catalog for example a product, does that data manipulation flow trough relaySyncApi and then sends a command to localMaster of that tenant to update itself?
    - Do we sync db of tenants on both sides? A tenant has localMaster with local SQLiteDB and his data should be aswell in postgres in cloud with relaySyncAPI, so it acts like a backup or security copy of the data
    - This is fundamental for the bigger picture and we need to answer these questions with yes, no partial yes


- [ ] Analytics owner module in staff
    - When hovering over the diagrams they show for example "700" instead of 7.00CHF because it uses raw Rappen number instead