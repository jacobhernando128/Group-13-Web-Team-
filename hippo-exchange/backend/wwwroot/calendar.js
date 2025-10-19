class CalendarView {
  constructor() {
    this.currentDate = new Date();
    this.events = [];
    this.allEvents = []; // Store all events for filtering
    this.borrowedItems = [];
    this.loanedItems = [];
    this.maintenanceItems = [];
    this.currentFilter = 'all';
    this.filterCounts = {
      'all': 0,
      'borrowed-return': 0,
      'loaned-return': 0,
      'required-maintenance': 0
    };
    
    this.init();
  }

  async init() {
    this.showLoading();
    try {
      await this.loadUserData();
      await this.loadCalendarData();
    } catch (error) {
      console.error('Error during initialization:', error);
      this.showError('Failed to initialize calendar: ' + error.message);
    } finally {
      this.setupEventListeners();
      this.renderCalendar();
      this.hideLoading();
    }
  }

  showLoading() {
    const loadingElement = document.getElementById('calendar-loading');
    if (loadingElement) {
      loadingElement.classList.remove('hidden');
    }
  }

  hideLoading() {
    const loadingElement = document.getElementById('calendar-loading');
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }
  }

  async loadUserData() {
    try {
      // Try multiple token sources
      const token = localStorage.getItem('hippo_token') || 
                   localStorage.getItem('userToken') || 
                   localStorage.getItem('token') ||
                   sessionStorage.getItem('hippo_token') ||
                   sessionStorage.getItem('userToken');
                   
      if (!token) {
        console.log('No token found, redirecting to login');
        this.showError('Please log in to access the calendar');
        setTimeout(() => {
          window.location.href = './Login.html';
        }, 2000);
        return;
      }

      console.log('Loading user data with token:', token.substring(0, 20) + '...');
      
      const response = await fetch('/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('User data response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.error('Authentication failed - token may be expired');
          this.showError('Session expired. Please log in again.');
          // Clear invalid tokens
          localStorage.removeItem('hippo_token');
          localStorage.removeItem('userToken');
          localStorage.removeItem('token');
          sessionStorage.removeItem('hippo_token');
          sessionStorage.removeItem('userToken');
          setTimeout(() => {
            window.location.href = './Login.html';
          }, 2000);
          return;
        }
        
        const errorText = await response.text();
        console.error('User data response error:', errorText);
        throw new Error(`Failed to load user data: ${response.status} ${errorText}`);
      }

      const userData = await response.json();
      console.log('Loaded user data:', userData);
      this.currentUser = userData;
      
      // Update UI
      const nameElement = document.getElementById('acct-name');
      const avatarElement = document.getElementById('acct-avatar');
      
      if (nameElement) {
        nameElement.textContent = `${userData.firstName} ${userData.lastName}`;
        console.log('Updated user name in UI');
      } else {
        console.warn('Could not find acct-name element');
      }
      
      const acctAvatar = document.getElementById('acct-avatar');
  const profilePic = userData.ProfilePicture || userData.profilePicture;
  if (acctAvatar && profilePic) {
    acctAvatar.src = profilePic;
    console.log('Updated profile picture:', profilePic);
  }
    } catch (error) {
      console.error('Error loading user data:', error);
      this.showError('Failed to load user data: ' + error.message);
      
      // If it's a network error, try to redirect to login
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setTimeout(() => {
          window.location.href = './Login.html';
        }, 2000);
      }
    }
  }

  async loadCalendarData() {
    try {
      const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
      
      console.log('📅 Loading calendar data...');
      console.log('📅 Current user:', this.currentUser);
      
      if (!this.currentUser) {
        console.error('No current user found');
        this.showError('No user data found');
        // Set empty arrays so calendar can still render
        this.borrowedItems = [];
        this.loanedItems = [];
        this.maintenanceItems = [];
        this.processEvents();
        this.updateFilterCounts();
        this.updateEventCount();
        return;
      }

      // Load real data from database with enhanced data fetching

      // Load borrowed items (items I'm borrowing) - use borrower endpoint
      const userId = this.currentUser.id || this.currentUser.userId || this.currentUser.Id;
      console.log('📅 Fetching borrowed items for user:', userId);
      const borrowedResponse = await fetch(`/exchanges/borrower/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('📅 Borrowed items response status:', borrowedResponse.status);
      if (borrowedResponse.ok) {
        this.borrowedItems = await borrowedResponse.json();
        console.log('📦 Loaded borrowed items:', this.borrowedItems.length, this.borrowedItems);
        
        // Enhance borrowed items with additional data
        try {
        await this.enhanceBorrowedItemsData();
        } catch (error) {
          console.warn('Enhancement failed, using basic data:', error);
        }
        
        // Ensure all borrowed items have required fields
        this.borrowedItems.forEach(item => {
          item.Title = item.Title || item.title || item.itemTitle || 'Unknown Item';
          item.OwnerName = item.OwnerName || item.ownerName || 'Unknown Owner';
          console.log('📦 Final borrowed item data:', item);
        });
      } else {
        console.warn('Failed to load borrowed items:', borrowedResponse.status, await borrowedResponse.text());
        this.borrowedItems = [];
      }

      // Load loaned items (items I own that are loaned out) - use owner endpoint
      console.log('📅 Fetching loaned items for user:', userId);
      const loanedResponse = await fetch(`/exchanges/owner/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('📅 Loaned items response status:', loanedResponse.status);
      if (loanedResponse.ok) {
        this.loanedItems = await loanedResponse.json();
        console.log('📦 Loaded loaned items:', this.loanedItems.length, this.loanedItems);
        
        // Enhance loaned items with additional data
        try {
        await this.enhanceLoanedItemsData();
        } catch (error) {
          console.warn('Enhancement failed, using basic data:', error);
        }
        
        // Ensure all loaned items have required fields
        this.loanedItems.forEach(item => {
          item.Title = item.Title || item.title || item.itemTitle || 'Unknown Item';
          item.BorrowerName = item.BorrowerName || item.borrowerName || 'Unknown Borrower';
          console.log('📦 Final loaned item data:', item);
        });
      } else {
        console.warn('Failed to load loaned items:', loanedResponse.status, await loanedResponse.text());
        this.loanedItems = [];
      }

      // For maintenance, we need to get user's items first, then get maintenance for each
      await this.loadMaintenanceData();

      await this.processEvents();
      this.updateFilterCounts();
      this.updateEventCount();
    } catch (error) {
      console.error('Error loading calendar data:', error);
      this.showError('Failed to load calendar data: ' + error.message);
    } finally {
      // Always hide loading and render calendar, even if there's an error
      this.hideLoading();
      this.renderCalendar();
    }
  }

  async enhanceBorrowedItemsData() {
    const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
    
    for (let item of this.borrowedItems) {
      try {
        // Fetch item details to get the title
        if (item.itemId) {
          const itemResponse = await fetch(`/items/${item.itemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            item.Title = itemData.title || itemData.Title || itemData.name || 'Unknown Item';
            console.log('🔍 Enhanced borrowed item with title:', item.Title);
          }
        }
        
        // Fetch owner details to get the owner name
        if (item.ownerId) {
          const ownerResponse = await fetch(`/users/${item.ownerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (ownerResponse.ok) {
            const ownerData = await ownerResponse.json();
            item.OwnerName = `${ownerData.firstName} ${ownerData.lastName}`;
            console.log('👤 Enhanced borrowed item with owner name:', item.OwnerName);
          }
        }
      } catch (error) {
        console.warn('Failed to enhance borrowed item data:', error);
      }
    }
  }

  async enhanceLoanedItemsData() {
    const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
    
    for (let item of this.loanedItems) {
      try {
        // Fetch item details to get the title
        if (item.itemId) {
          const itemResponse = await fetch(`/items/${item.itemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            item.Title = itemData.title || itemData.Title || itemData.name || 'Unknown Item';
            console.log('🔍 Enhanced loaned item with title:', item.Title);
          }
        }
        
        // Fetch borrower details to get the borrower name
        if (item.borrowerId) {
          const borrowerResponse = await fetch(`/users/${item.borrowerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (borrowerResponse.ok) {
            const borrowerData = await borrowerResponse.json();
            item.BorrowerName = `${borrowerData.firstName} ${borrowerData.lastName}`;
            console.log('👤 Enhanced loaned item with borrower name:', item.BorrowerName);
          }
        }
      } catch (error) {
        console.warn('Failed to enhance loaned item data:', error);
      }
    }
  }

  async loadMaintenanceData() {
    try {
      const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
      
      // Use the new maintenance calendar endpoint
      const userId = this.currentUser.id || this.currentUser.userId || this.currentUser.Id;
      console.log('📅 Fetching maintenance calendar data for user:', userId);
      const maintenanceResponse = await fetch(`/maintenance/calendar/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('📅 Maintenance calendar response status:', maintenanceResponse.status);
      
            if (maintenanceResponse.ok) {
        const maintenanceEvents = await maintenanceResponse.json();
        console.log('🔧 Loaded maintenance events:', maintenanceEvents.length, maintenanceEvents);
        
        // Convert maintenance events to the expected format
        this.maintenanceItems = maintenanceEvents.map(event => ({
          id: event.maintenanceId,
          Title: event.itemTitle,
          itemId: event.itemId,
          maintenanceHistory: [{
            id: event.maintenanceId,
            description: event.description,
            category: event.category,
            frequency: event.frequency,
            nextMaintenanceDate: event.nextMaintenanceDate,
            lastMaintenanceDate: event.lastMaintenanceDate,
            type: event.type
          }]
        }));
        
        console.log('🔧 Converted maintenance events to items:', this.maintenanceItems.length);
      } else {
        console.warn('Failed to load maintenance calendar data:', maintenanceResponse.status);
        this.maintenanceItems = [];
      }
    } catch (error) {
      console.error('Error loading maintenance data:', error);
      this.maintenanceItems = [];
    }
  }


  async processEvents() {
    this.events = [];
    this.allEvents = [];

    console.log('📅 Processing events...', {
      borrowed: this.borrowedItems.length,
      loaned: this.loanedItems.length,
      maintenance: this.maintenanceItems.length
    });
    
    // Debug: Log the actual data being processed
    console.log('🔍 Borrowed items data:', this.borrowedItems);
    console.log('🔍 Loaned items data:', this.loanedItems);
    console.log('🔍 Maintenance items data:', this.maintenanceItems);

    // Process borrowed items (return dates)
    for (const item of this.borrowedItems) {
      console.log('🔍 Processing borrowed item:', item);
      if (item.endDate) {
        // Fetch item details to get the title
        let itemTitle = 'Unknown Item';
        try {
          const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
          const itemResponse = await fetch(`/items/${item.itemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            itemTitle = itemData.title || itemData.Title || 'Unknown Item';
          }
        } catch (error) {
          console.warn('Failed to fetch item details for borrowed item:', error);
        }
        
        console.log('🔍 Extracting item title for borrowed item:', { item, extractedTitle: itemTitle });
        const event = {
          id: `borrowed-${item.id}`,
          date: new Date(item.endDate),
          type: 'borrowed-return',
          title: `Return ${itemTitle}`,
          description: `Return borrowed item: ${itemTitle}${item.OwnerName ? ` (from ${item.OwnerName})` : ''}`,
          color: 'blue',
          item: item
        };
        this.events.push(event);
        this.allEvents.push(event);
        console.log('📦 Added borrowed event:', event.title, 'from item:', item);
      } else {
        console.log('⚠️ Borrowed item missing endDate:', item);
      }
    }

    // Process loaned items (return dates)
    for (const item of this.loanedItems) {
      console.log('🔍 Processing loaned item:', item);
      if (item.endDate) {
        // Fetch item details to get the title
        let itemTitle = 'Unknown Item';
        try {
          const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
          const itemResponse = await fetch(`/items/${item.itemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            itemTitle = itemData.title || itemData.Title || 'Unknown Item';
          }
        } catch (error) {
          console.warn('Failed to fetch item details for loaned item:', error);
        }
        
        console.log('🔍 Extracting item title for loaned item:', { item, extractedTitle: itemTitle });
        const event = {
          id: `loaned-${item.id}`,
          date: new Date(item.endDate),
          type: 'loaned-return',
          title: `Return ${itemTitle}`,
          description: `Item return due: ${itemTitle}${item.BorrowerName ? ` (borrowed by ${item.BorrowerName})` : ''}`,
          color: 'green',
          item: item
        };
        this.events.push(event);
        this.allEvents.push(event);
        console.log('📦 Added loaned event:', event.title, 'from item:', item);
      } else {
        console.log('⚠️ Loaned item missing endDate:', item);
      }
    }

    // Process maintenance items (only required maintenance)
    this.maintenanceItems.forEach(item => {
      console.log('🔍 Processing maintenance item:', item);
      if (item.maintenanceHistory && Array.isArray(item.maintenanceHistory)) {
        console.log('🔧 Item has maintenance history:', item.maintenanceHistory.length, 'records');
        item.maintenanceHistory.forEach(maintenance => {
          console.log('🔧 Processing maintenance record:', maintenance);
          // Check for nextMaintenanceDate and type 'required-maintenance' (from new API)
          const maintenanceDate = maintenance.nextMaintenanceDate || maintenance.date;
          const maintenanceType = maintenance.type;
          
          if (maintenanceDate && (maintenanceType === 'required-maintenance' || maintenanceType === 'required')) {
            const itemTitle = item.Title || item.title || item.itemName || item.name || item.itemTitle || 'Unknown Item';
            console.log('🔍 Extracting item title for maintenance item:', { item, extractedTitle: itemTitle });
            
            // Create more descriptive maintenance event
            const category = maintenance.category || 'General';
            const frequency = maintenance.frequency || 'As needed';
            
            const event = {
              id: `maintenance-${item.id}-${maintenance.id}`,
              date: new Date(maintenanceDate),
              type: 'required-maintenance',
              title: `Maintenance: ${itemTitle}`,
              description: `${category} maintenance for ${itemTitle} (${frequency})`,
              color: 'orange',
              item: item,
              maintenance: maintenance
            };
            this.events.push(event);
            this.allEvents.push(event);
            console.log('🔧 Added maintenance event:', event.title, 'from item:', item);
          } else {
            console.log('⚠️ Maintenance record missing date or not required:', maintenance);
          }
        });
      } else {
        console.log('⚠️ Item has no maintenance history:', item);
      }
    });

    console.log('📅 Processed events:', this.allEvents.length);
    console.log('📅 Event details:', this.allEvents.map(e => ({ type: e.type, title: e.title, color: e.color })));
  }

  updateFilterCounts() {
    // Reset counts
    Object.keys(this.filterCounts).forEach(key => {
      this.filterCounts[key] = 0;
    });

    // Count events by type
    this.allEvents.forEach(event => {
      this.filterCounts[event.type]++;
      this.filterCounts['all']++;
    });

    // Update filter count display (like home page)
    const filterCountElement = document.getElementById('filter-count');
    if (filterCountElement) {
      const totalEvents = this.allEvents.length;
      if (totalEvents === 0) {
        filterCountElement.textContent = 'No events';
      } else if (totalEvents === 1) {
        filterCountElement.textContent = '1 event';
      } else {
        filterCountElement.textContent = `${totalEvents} events`;
      }
    }
  }

  updateEventCount() {
    const eventCountElement = document.getElementById('event-count');
    if (eventCountElement) {
      const visibleEvents = this.currentFilter === 'all' ? this.allEvents.length : this.filterCounts[this.currentFilter];
      eventCountElement.textContent = `${visibleEvents} event${visibleEvents !== 1 ? 's' : ''}`;
    }

    // Also update the filter count display
    const filterCountElement = document.getElementById('filter-count');
    if (filterCountElement) {
      const visibleEvents = this.currentFilter === 'all' ? this.allEvents.length : this.filterCounts[this.currentFilter];
      if (visibleEvents === 0) {
        filterCountElement.textContent = 'No events';
      } else if (visibleEvents === 1) {
        filterCountElement.textContent = '1 event';
      } else {
        filterCountElement.textContent = `${visibleEvents} events`;
      }
    }
  }

  applyFilter(filterType) {
    console.log('🔍 Applying filter:', filterType);
    this.currentFilter = filterType;
    
    // Update active filter tag using the same logic as home page
    this.updateCategoryButtons(filterType);

    // Filter events
    if (filterType === 'all') {
      this.events = [...this.allEvents];
      console.log('📅 Showing all events:', this.events.length);
    } else {
      this.events = this.allEvents.filter(event => event.type === filterType);
      console.log(`📅 Filtered to ${filterType}:`, this.events.length, 'events');
      console.log('📅 Filtered events:', this.events.map(e => ({ type: e.type, title: e.title })));
    }

    this.updateEventCount();
    this.renderCalendar();
  }

  updateCategoryButtons(activeCategory) {
    const buttons = document.querySelectorAll('.category-filter');
    buttons.forEach(button => {
      const category = button.dataset.category;
      if (category === activeCategory) {
        button.classList.add('active', 'bg-blue-500', 'text-white', 'shadow-md');
        button.classList.remove('bg-white/40', 'text-slate-700', 'hover:bg-blue-100', 'hover:text-blue-800');
      } else {
        button.classList.remove('active', 'bg-blue-500', 'text-white', 'shadow-md');
        button.classList.add('bg-white/40', 'text-slate-700', 'hover:bg-blue-100', 'hover:text-blue-800');
      }
    });
  }

  async refreshData() {
    console.log('🔄 Refreshing calendar data...');
    this.showLoading();
    
    try {
      await this.loadCalendarData();
      this.renderCalendar();
      console.log('✅ Calendar data refreshed successfully');
    } catch (error) {
      console.error('❌ Failed to refresh calendar data:', error);
      this.showError('Failed to refresh data');
    } finally {
      this.hideLoading();
    }
  }


  setupEventListeners() {
    // Month navigation
    const prevMonthBtn = document.getElementById('prev-month');
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => {
        if (!prevMonthBtn.disabled) {
          this.currentDate.setMonth(this.currentDate.getMonth() - 1);
          this.renderCalendar();
        }
      });
    }

    const nextMonthBtn = document.getElementById('next-month');
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        if (!nextMonthBtn.disabled) {
          this.currentDate.setMonth(this.currentDate.getMonth() + 1);
          this.renderCalendar();
        }
      });
    }

    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.currentDate = new Date();
        this.renderCalendar();
      });
    }

    // Filter tags - use the same pattern as home page
    const filterTags = document.querySelectorAll('.category-filter');
    console.log('Found filter tags:', filterTags.length);
    filterTags.forEach(tag => {
      console.log('Adding event listener to filter:', tag.dataset.category);
      tag.addEventListener('click', () => {
        const filterType = tag.dataset.category;
        console.log('Filter clicked:', filterType);
        this.applyFilter(filterType);
      });
    });

    // Refresh data
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshData();
      });
    }


    // Legend cards (also act as filters)
    document.querySelectorAll('.legend-card').forEach(card => {
      card.addEventListener('click', () => {
        const filterType = card.dataset.type;
        this.applyFilter(filterType);
      });
    });

    // Modal close
    const closeModalBtn = document.getElementById('close-event-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        this.closeEventModal();
      });
    }

    const closeModalBtn2 = document.getElementById('close-event-modal-btn');
    if (closeModalBtn2) {
      closeModalBtn2.addEventListener('click', () => {
        this.closeEventModal();
      });
    }

    // Close modal on backdrop click
    const eventModal = document.getElementById('event-modal');
    if (eventModal) {
      eventModal.addEventListener('click', (e) => {
        if (e.target.id === 'event-modal') {
          this.closeEventModal();
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('hippo_token');
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        window.location.href = './Login.html';
    });
  }

    // Mobile menu
    const menuButton = document.getElementById('menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar && backdrop) {
          sidebar.classList.toggle('-translate-x-full');
          backdrop.classList.toggle('hidden');
        }
      });
    }

    const closeMenuBtn = document.getElementById('close-menu');
    if (closeMenuBtn) {
      closeMenuBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar && backdrop) {
          sidebar.classList.add('-translate-x-full');
          backdrop.classList.add('hidden');
        }
      });
    }

    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar && backdrop) {
          sidebar.classList.add('-translate-x-full');
          backdrop.classList.add('hidden');
        }
      });
    }
  }

  renderCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // Update month display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;

    // Update navigation button states
    this.updateNavigationButtons();

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Clear calendar
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';

    // Add day headers with enhanced styling
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.className = 'p-4 text-center font-bold text-slate-800 bg-gradient-to-br from-slate-100 via-slate-200 to-blue-100 rounded-3xl border border-slate-200 shadow-xl text-lg backdrop-blur-sm';
      header.textContent = day;
      calendarGrid.appendChild(header);
    });

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'h-40 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 rounded-2xl border border-slate-200 shadow-lg backdrop-blur-sm';
      calendarGrid.appendChild(emptyCell);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayCell = this.createDayCell(day, month, year);
      calendarGrid.appendChild(dayCell);
    }
  }

  updateNavigationButtons() {
    const prevButton = document.getElementById('prev-month');
    const nextButton = document.getElementById('next-month');
    
    // Check if there are events in the current month
    const hasEventsInCurrentMonth = this.hasEventsInMonth(this.currentDate);
    
    // Check if there are events in the next month
    const nextMonth = new Date(this.currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const hasEventsInNextMonth = this.hasEventsInMonth(nextMonth);
    
    // Check if there are events in the previous month
    const prevMonth = new Date(this.currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const hasEventsInPrevMonth = this.hasEventsInMonth(prevMonth);
    
    // Disable next button if no events in next month
    if (!hasEventsInNextMonth) {
      nextButton.disabled = true;
      nextButton.classList.add('opacity-50', 'cursor-not-allowed');
      nextButton.classList.remove('hover:bg-white/80', 'hover:scale-105');
    } else {
      nextButton.disabled = false;
      nextButton.classList.remove('opacity-50', 'cursor-not-allowed');
      nextButton.classList.add('hover:bg-white/80', 'hover:scale-105');
    }
    
    // Disable prev button if no events in previous month
    if (!hasEventsInPrevMonth) {
      prevButton.disabled = true;
      prevButton.classList.add('opacity-50', 'cursor-not-allowed');
      prevButton.classList.remove('hover:bg-white/80', 'hover:scale-105');
    } else {
      prevButton.disabled = false;
      prevButton.classList.remove('opacity-50', 'cursor-not-allowed');
      prevButton.classList.add('hover:bg-white/80', 'hover:scale-105');
    }
  }

  hasEventsInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    return this.events.some(event => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  }

  createDayCell(day, month, year) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day h-40 bg-gradient-to-br from-white via-slate-50 to-blue-50 border border-slate-200 rounded-2xl p-3 overflow-visible relative shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group backdrop-blur-sm flex flex-col';
    
    const date = new Date(year, month, day);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const dayEvents = this.getEventsForDate(date);
    
    if (isToday) {
      cell.classList.add('ring-4', 'ring-blue-400', 'bg-gradient-to-br', 'from-blue-100', 'via-blue-50', 'to-indigo-100', 'shadow-2xl', 'border-blue-300');
    } else if (dayEvents.length > 0) {
      cell.classList.add('bg-gradient-to-br', 'from-white', 'via-slate-50', 'to-emerald-50', 'border-emerald-200', 'shadow-lg');
    } else {
      cell.classList.add('hover:bg-gradient-to-br', 'hover:from-slate-50', 'hover:to-blue-50');
    }

    // Day number with enhanced styling
    const dayNumber = document.createElement('div');
    dayNumber.className = `text-xl font-bold mb-2 flex items-center justify-between ${isToday ? 'text-blue-700' : dayEvents.length > 0 ? 'text-slate-800' : 'text-slate-600'}`;
    
    const dayText = document.createElement('span');
    dayText.textContent = day;
    dayNumber.appendChild(dayText);
    
    // Add event count indicator with better styling
    if (dayEvents.length > 0) {
      const eventCount = document.createElement('span');
      eventCount.className = `text-xs px-2 py-1 rounded-xl font-bold shadow-lg ${isToday ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' : 'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700 border border-emerald-300'}`;
      eventCount.textContent = dayEvents.length;
      dayNumber.appendChild(eventCount);
    }
    
    cell.appendChild(dayNumber);

    // Events for this day
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'space-y-0.5 flex-1';
    
    dayEvents.slice(0, 2).forEach(event => {
      const eventElement = document.createElement('div');
      
      // Enhanced color mapping for better visual distinction
      let colorClasses = '';
      switch(event.color) {
        case 'blue':
          colorClasses = 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-400 shadow-blue-200';
          break;
        case 'green':
          colorClasses = 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-400 shadow-emerald-200';
          break;
        case 'orange':
          colorClasses = 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-400 shadow-orange-200';
          break;
        default:
          colorClasses = 'bg-gradient-to-r from-slate-500 to-slate-600 border-slate-400 shadow-slate-200';
      }
      
      eventElement.className = `event-badge text-xs px-2 py-1.5 rounded-xl cursor-pointer hover:opacity-90 transition-all duration-300 text-white shadow-lg hover:shadow-xl hover:scale-105 font-semibold border-2 overflow-hidden mb-1 ${colorClasses}`;
      
      // Create a more compact title for display with ellipsis for overflow
      let displayTitle = event.title;
      if (displayTitle.length > 12) {
        displayTitle = displayTitle.substring(0, 12) + '...';
      }
      
      eventElement.textContent = displayTitle;
      eventElement.title = event.description || event.title; // Show full title on hover
      eventElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showEventModal(event);
      });
      eventsContainer.appendChild(eventElement);
    });

    // Show "click to see more" text and make cell clickable if there are more than 2 events
    if (dayEvents.length > 2) {
      const moreElement = document.createElement('div');
      moreElement.className = 'text-xs text-slate-500 mt-1 text-center';
      moreElement.textContent = 'click to see more';
      eventsContainer.appendChild(moreElement);
      
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', (e) => {
        // Don't trigger if clicking on an individual event
        if (!e.target.closest('.event-badge')) {
          this.showDayEventsModal(date, dayEvents);
        }
      });
    }

    // Add subtle hover effect and empty state
    if (dayEvents.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'text-sm text-slate-400 text-center mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 font-medium';
      emptyState.textContent = '✨ No events today';
      eventsContainer.appendChild(emptyState);
    }

    cell.appendChild(eventsContainer);
    return cell;
  }

  getEventsForDate(date) {
    // Use filtered events (this.events) to respect the current filter
    const eventsForDate = this.events.filter(event => {
      return event.date.toDateString() === date.toDateString();
    });
    return eventsForDate;
  }

  showEventModal(event) {
    const modal = document.getElementById('event-modal');
    const modalContent = document.getElementById('event-modal-content');
    const eventTitle = document.getElementById('event-title');
    const eventDetails = document.getElementById('event-details');

    eventTitle.textContent = event.title;
    
    let detailsHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-3 p-3 bg-${event.color}-50 rounded-xl border border-${event.color}-200">
          <div class="w-3 h-3 rounded-full bg-${event.color}-500"></div>
          <span class="text-sm font-medium text-${event.color}-700 capitalize">${event.type.replace('-', ' ')}</span>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-medium text-slate-600">Date</label>
            <p class="text-slate-800 font-semibold">${event.date.toLocaleDateString()}</p>
          </div>
          <div>
            <label class="text-sm font-medium text-slate-600">Description</label>
            <p class="text-slate-800">${event.description}</p>
          </div>
        </div>
    `;

    // Add specific details based on event type
    if (event.type === 'borrowed-return') {
      detailsHTML += `
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-medium text-slate-600">Borrowed From</label>
            <p class="text-slate-800 font-semibold">${event.item.ownerName || 'Unknown'}</p>
          </div>
          <div>
            <label class="text-sm font-medium text-slate-600">Start Date</label>
            <p class="text-slate-800">${event.item.startDate ? new Date(event.item.startDate).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      `;
    } else if (event.type === 'loaned-return') {
      detailsHTML += `
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-medium text-slate-600">Borrowed By</label>
            <p class="text-slate-800 font-semibold">${event.item.borrowerName || 'Unknown'}</p>
          </div>
          <div>
            <label class="text-sm font-medium text-slate-600">Start Date</label>
            <p class="text-slate-800">${event.item.startDate ? new Date(event.item.startDate).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      `;
    } else if (event.type.includes('maintenance')) {
      detailsHTML += `
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-medium text-slate-600">Item</label>
            <p class="text-slate-800 font-semibold">${event.item.title}</p>
          </div>
          <div>
            <label class="text-sm font-medium text-slate-600">Maintenance Type</label>
            <p class="text-slate-800 capitalize">${event.maintenance.type}</p>
          </div>
        </div>
      `;
      if (event.maintenance.cost && event.maintenance.cost > 0) {
        detailsHTML += `
          <div>
            <label class="text-sm font-medium text-slate-600">Cost</label>
            <p class="text-slate-800 font-semibold text-green-600">$${event.maintenance.cost.toFixed(2)}</p>
          </div>
        `;
    }
    }

    detailsHTML += '</div>';
    eventDetails.innerHTML = detailsHTML;

    // Show modal with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
      modalContent.classList.remove('scale-95', 'opacity-0');
      modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
  }

  showDayEventsModal(date, events) {
    const modal = document.getElementById('event-modal');
    const modalContent = document.getElementById('event-modal-content');
    const eventTitle = document.getElementById('event-title');
    const eventDetails = document.getElementById('event-details');

    eventTitle.textContent = `${events.length} Events on ${date.toLocaleDateString()}`;
    
    let detailsHTML = '<div class="space-y-4 max-h-96 overflow-y-auto">';
    events.forEach((event, index) => {
      const colorClasses = {
        'blue': 'bg-blue-50 border-blue-200 hover:bg-blue-100',
        'green': 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
        'orange': 'bg-orange-50 border-orange-200 hover:bg-orange-100'
      };
      const dotColors = {
        'blue': 'bg-blue-500',
        'green': 'bg-emerald-500',
        'orange': 'bg-orange-500'
      };
      
      detailsHTML += `
        <div class="p-4 ${colorClasses[event.color] || 'bg-slate-50 border-slate-200 hover:bg-slate-100'} rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md" onclick="this.parentElement.parentElement.parentElement.querySelector('#close-event-modal').click(); setTimeout(() => { window.calendarView.showEventModal(${JSON.stringify(event).replace(/"/g, '&quot;')}); }, 300);">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-4 h-4 rounded-full ${dotColors[event.color] || 'bg-slate-500'} shadow-sm"></div>
            <span class="font-semibold text-slate-800 text-lg">${event.title}</span>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed">${event.description}</p>
          <div class="mt-2 text-xs text-slate-500 font-medium">
            ${event.type.replace('-', ' ').toUpperCase()}
          </div>
        </div>
      `;
    });
    detailsHTML += '</div>';
    
    eventDetails.innerHTML = detailsHTML;

    // Show modal with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
      modalContent.classList.remove('scale-95', 'opacity-0');
      modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
  }

  closeEventModal() {
    const modal = document.getElementById('event-modal');
    const modalContent = document.getElementById('event-modal-content');
    
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }

  showError(message) {
    console.error('Calendar Error:', message);
    
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 5000);
  }
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.calendarView = new CalendarView();
});

// Global event listener for filter clicks (like home page)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('category-filter')) {
    const category = e.target.dataset.category;
    console.log('🖱️ Filter button clicked:', category);
    if (window.calendarView) {
      window.calendarView.applyFilter(category);
    } else {
      console.error('❌ Calendar view not found!');
    }
  }
});
